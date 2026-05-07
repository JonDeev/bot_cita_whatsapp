import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { AuditService } from '../../../audit/application/services/audit.service';
import { ConversationOrchestratorService } from '../services/conversation-orchestrator.service';
import {
  WHATSAPP_PAYLOAD_PARSER,
  WHATSAPP_WEBHOOK_INBOX_REPOSITORY,
  WHATSAPP_SIGNATURE_VERIFIER,
  WHATSAPP_WEBHOOK_IDEMPOTENCY_STORE,
} from '../../domain/whatsapp.tokens';
import type { WhatsappPayloadParserPort } from '../../domain/ports/whatsapp-payload-parser.port';
import type {
  WebhookInboxRepositoryPort,
  WebhookProcessingStatus,
} from '../../domain/ports/webhook-inbox.repository.port';
import type { WhatsappSignatureVerifierPort } from '../../domain/ports/whatsapp-signature-verifier.port';
import type { WebhookIdempotencyStorePort } from '../../domain/ports/webhook-idempotency-store.port';
import { WebhookIdempotencyKeyFactory } from '../services/idempotency/webhook-idempotency-key.factory';
import { WhatsappConfigService } from '../services/whatsapp-config.service';
import type { NormalizedWhatsappEvent } from '../../domain/events/normalized-whatsapp.event';

export interface ProcessWhatsappWebhookInput {
  rawBody: Buffer;
  signatureHeader?: string;
  payload: unknown;
}

@Injectable()
export class ProcessWhatsappWebhookUseCase {
  private static readonly IDEMPOTENCY_TTL_SECONDS = 60 * 60 * 24;

  constructor(
    @Inject(WHATSAPP_SIGNATURE_VERIFIER)
    private readonly signatureVerifier: WhatsappSignatureVerifierPort,
    @Inject(WHATSAPP_PAYLOAD_PARSER)
    private readonly payloadParser: WhatsappPayloadParserPort,
    @Inject(WHATSAPP_WEBHOOK_INBOX_REPOSITORY)
    private readonly webhookInboxRepository: WebhookInboxRepositoryPort,
    @Inject(WHATSAPP_WEBHOOK_IDEMPOTENCY_STORE)
    private readonly idempotencyStore: WebhookIdempotencyStorePort,
    private readonly idempotencyKeyFactory: WebhookIdempotencyKeyFactory,
    private readonly whatsappConfig: WhatsappConfigService,
    private readonly auditService: AuditService,
    private readonly orchestrator: ConversationOrchestratorService,
  ) {}

  async execute(input: ProcessWhatsappWebhookInput): Promise<void> {
    const isValidSignature = this.signatureVerifier.verifySignature(
      input.rawBody,
      input.signatureHeader,
    );

    if (!isValidSignature) {
      throw new UnauthorizedException('Invalid WhatsApp webhook signature.');
    }

    const receivedAt = new Date().toISOString();
    const normalizedEvents = this.payloadParser.parse(input.payload, receivedAt);
    const payloadHash = createHash('sha256').update(input.rawBody).digest('hex');

    for (const event of normalizedEvents) {
      const idempotencyKey = this.idempotencyKeyFactory.create(event);
      const providerOccurredAt = this.resolveProviderOccurredAt(event, receivedAt);
      const persistedEvent = await this.webhookInboxRepository.saveIfFirstSeen({
        deduplicationKey: idempotencyKey,
        providerMessageId: event.messageId,
        eventKind: event.kind,
        phoneNumberId: event.phoneNumberId ?? null,
        participantPhone: this.resolveParticipantPhone(event),
        messageType: event.kind === 'incoming_message_received' ? event.messageType : null,
        interactiveReplyId:
          event.kind === 'incoming_message_received' ? event.interactiveReplyId ?? null : null,
        contextMessageId:
          event.kind === 'incoming_message_received' ? event.contextMessageId ?? null : null,
        providerOccurredAt,
        receivedAt: event.receivedAt ?? receivedAt,
        signatureValid: true,
        payloadHash,
        payload: this.whatsappConfig.shouldStoreWebhookPayloads() ? input.payload : null,
      });

      if (!persistedEvent.created) {
        await this.auditService.record('whatsapp.webhook.duplicate_skipped', {
          idempotencyKey,
          eventKind: event.kind,
          messageId: event.messageId,
        });
        continue;
      }

      await this.idempotencyStore.tryAcquire(
        idempotencyKey,
        ProcessWhatsappWebhookUseCase.IDEMPOTENCY_TTL_SECONDS,
      );

      const staleRejectionReason = this.resolveStaleRejectionReason(event);
      if (staleRejectionReason) {
        await this.markWebhookEvent(
          idempotencyKey,
          'SKIPPED_STALE',
          receivedAt,
          staleRejectionReason,
        );
        await this.auditService.record('whatsapp.webhook.stale_skipped', {
          idempotencyKey,
          eventKind: event.kind,
          messageId: event.messageId,
          rejectionReason: staleRejectionReason,
        });
        continue;
      }

      await this.auditService.record('whatsapp.webhook.event_accepted', {
        idempotencyKey,
        eventKind: event.kind,
        messageId: event.messageId,
      });

      try {
        await this.orchestrator.handleEvents([event]);
        await this.markWebhookEvent(idempotencyKey, 'PROCESSED', new Date().toISOString());
      } catch (error) {
        await this.markWebhookEvent(
          idempotencyKey,
          'FAILED',
          new Date().toISOString(),
          null,
          error instanceof Error ? error.message : 'Unknown webhook processing failure.',
        );
        throw error;
      }
    }
  }

  private async markWebhookEvent(
    deduplicationKey: string,
    processingStatus: WebhookProcessingStatus,
    processedAt: string,
    rejectionReason?: string | null,
    errorMessage?: string | null,
  ): Promise<void> {
    await this.webhookInboxRepository.updateStatus({
      deduplicationKey,
      processingStatus,
      processedAt,
      rejectionReason,
      errorMessage,
    });
  }

  private resolveProviderOccurredAt(event: NormalizedWhatsappEvent, fallback: string): string {
    const milliseconds = Number(event.timestamp) * 1000;
    if (!Number.isFinite(milliseconds)) {
      return fallback;
    }

    return new Date(milliseconds).toISOString();
  }

  private resolveParticipantPhone(event: NormalizedWhatsappEvent): string | null {
    if (event.kind === 'incoming_message_received') {
      return event.from;
    }

    return event.recipientId;
  }

  private resolveStaleRejectionReason(event: NormalizedWhatsappEvent): string | null {
    if (event.kind !== 'incoming_message_received') {
      return null;
    }

    const maxAgeSeconds =
      event.messageType === 'interactive'
        ? this.whatsappConfig.getInteractiveEventMaxAgeSeconds()
        : this.whatsappConfig.getTextEventMaxAgeSeconds();

    if (!maxAgeSeconds) {
      return null;
    }

    const providerOccurredAt = Number(event.timestamp) * 1000;
    const receivedAt = Date.parse(event.receivedAt ?? new Date().toISOString());
    if (!Number.isFinite(providerOccurredAt) || !Number.isFinite(receivedAt)) {
      return null;
    }

    const ageSeconds = Math.max(0, Math.floor((receivedAt - providerOccurredAt) / 1000));
    if (ageSeconds <= maxAgeSeconds) {
      return null;
    }

    if (event.messageType === 'interactive') {
      return 'INTERACTIVE_EVENT_TOO_OLD';
    }

    return 'TEXT_EVENT_TOO_OLD';
  }
}
