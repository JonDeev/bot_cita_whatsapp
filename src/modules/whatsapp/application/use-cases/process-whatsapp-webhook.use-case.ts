import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuditService } from '../../../audit/application/services/audit.service';
import { ConversationOrchestratorService } from '../services/conversation-orchestrator.service';
import {
  WHATSAPP_PAYLOAD_PARSER,
  WHATSAPP_SIGNATURE_VERIFIER,
  WHATSAPP_WEBHOOK_IDEMPOTENCY_STORE,
} from '../../domain/whatsapp.tokens';
import type { WhatsappPayloadParserPort } from '../../domain/ports/whatsapp-payload-parser.port';
import type { WhatsappSignatureVerifierPort } from '../../domain/ports/whatsapp-signature-verifier.port';
import type { WebhookIdempotencyStorePort } from '../../domain/ports/webhook-idempotency-store.port';
import { WebhookIdempotencyKeyFactory } from '../services/idempotency/webhook-idempotency-key.factory';

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
    @Inject(WHATSAPP_WEBHOOK_IDEMPOTENCY_STORE)
    private readonly idempotencyStore: WebhookIdempotencyStorePort,
    private readonly idempotencyKeyFactory: WebhookIdempotencyKeyFactory,
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

    const normalizedEvents = this.payloadParser.parse(input.payload);
    const uniqueEvents: typeof normalizedEvents = [];

    for (const event of normalizedEvents) {
      const idempotencyKey = this.idempotencyKeyFactory.create(event);
      const acquired = await this.idempotencyStore.tryAcquire(
        idempotencyKey,
        ProcessWhatsappWebhookUseCase.IDEMPOTENCY_TTL_SECONDS,
      );

      if (!acquired) {
        await this.auditService.record('whatsapp.webhook.duplicate_skipped', {
          idempotencyKey,
          eventKind: event.kind,
          messageId: event.messageId,
        });
        continue;
      }

      uniqueEvents.push(event);
      await this.auditService.record('whatsapp.webhook.event_accepted', {
        idempotencyKey,
        eventKind: event.kind,
        messageId: event.messageId,
      });
    }

    if (uniqueEvents.length === 0) {
      return;
    }

    await this.orchestrator.handleEvents(uniqueEvents);
  }
}
