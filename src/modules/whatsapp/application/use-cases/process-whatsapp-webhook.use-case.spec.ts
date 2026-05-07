import { UnauthorizedException } from '@nestjs/common';
import { AuditService } from '../../../audit/application/services/audit.service';
import { ConversationOrchestratorService } from '../services/conversation-orchestrator.service';
import { WebhookIdempotencyKeyFactory } from '../services/idempotency/webhook-idempotency-key.factory';
import { ProcessWhatsappWebhookUseCase } from './process-whatsapp-webhook.use-case';
import { NormalizedWhatsappEvent } from '../../domain/events/normalized-whatsapp.event';

describe('ProcessWhatsappWebhookUseCase', () => {
  it('processes only events that are first seen in the durable inbox', async () => {
    const event: NormalizedWhatsappEvent = {
      kind: 'incoming_message_received',
      messageId: 'wamid-1',
      from: '573001112233',
      timestamp: '1711111111',
      receivedAt: '2026-05-07T12:44:15.000Z',
      messageType: 'text',
      textBody: 'hola',
      phoneNumberId: '123',
    };

    const signatureVerifier = { verifySignature: jest.fn().mockReturnValue(true) };
    const payloadParser = { parse: jest.fn().mockReturnValue([event, event]) };
    const webhookInboxRepository = {
      saveIfFirstSeen: jest.fn().mockResolvedValueOnce({ created: true }).mockResolvedValueOnce({
        created: false,
      }),
      updateStatus: jest.fn().mockResolvedValue(undefined),
    };
    const idempotencyStore = {
      tryAcquire: jest.fn().mockResolvedValue(true),
    };
    const whatsappConfig = {
      shouldStoreWebhookPayloads: jest.fn().mockReturnValue(true),
      getInteractiveEventMaxAgeSeconds: jest.fn().mockReturnValue(null),
      getTextEventMaxAgeSeconds: jest.fn().mockReturnValue(null),
    };
    const auditService = { record: jest.fn().mockResolvedValue(undefined) } as unknown as AuditService;
    const orchestrator = {
      handleEvents: jest.fn().mockResolvedValue(undefined),
    } as unknown as ConversationOrchestratorService;

    const useCase = new ProcessWhatsappWebhookUseCase(
      signatureVerifier,
      payloadParser,
      webhookInboxRepository as any,
      idempotencyStore,
      new WebhookIdempotencyKeyFactory(),
      whatsappConfig as any,
      auditService,
      orchestrator,
    );

    await useCase.execute({
      rawBody: Buffer.from('{}'),
      signatureHeader: 'sha256=test',
      payload: {},
    });

    expect(orchestrator.handleEvents).toHaveBeenCalledTimes(1);
    expect(orchestrator.handleEvents).toHaveBeenCalledWith([event]);
    expect(webhookInboxRepository.updateStatus).toHaveBeenCalledWith(
      expect.objectContaining({
        processingStatus: 'PROCESSED',
      }),
    );
  });

  it('throws when signature is invalid', async () => {
    const signatureVerifier = { verifySignature: jest.fn().mockReturnValue(false) };
    const payloadParser = { parse: jest.fn() };
    const webhookInboxRepository = {
      saveIfFirstSeen: jest.fn(),
      updateStatus: jest.fn(),
    };
    const idempotencyStore = { tryAcquire: jest.fn() };
    const whatsappConfig = {
      shouldStoreWebhookPayloads: jest.fn(),
      getInteractiveEventMaxAgeSeconds: jest.fn(),
      getTextEventMaxAgeSeconds: jest.fn(),
    };
    const auditService = { record: jest.fn() } as unknown as AuditService;
    const orchestrator = { handleEvents: jest.fn() } as unknown as ConversationOrchestratorService;

    const useCase = new ProcessWhatsappWebhookUseCase(
      signatureVerifier,
      payloadParser,
      webhookInboxRepository as any,
      idempotencyStore,
      new WebhookIdempotencyKeyFactory(),
      whatsappConfig as any,
      auditService,
      orchestrator,
    );

    await expect(
      useCase.execute({
        rawBody: Buffer.from('{}'),
        signatureHeader: undefined,
        payload: {},
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('skips stale interactive events before orchestration', async () => {
    const event: NormalizedWhatsappEvent = {
      kind: 'incoming_message_received',
      messageId: 'wamid-stale',
      from: '573001112233',
      timestamp: '1711111111',
      receivedAt: '2026-05-07T12:44:15.000Z',
      messageType: 'interactive',
      interactiveReplyId: 'main_menu_request_appointment',
      phoneNumberId: '123',
    };

    const signatureVerifier = { verifySignature: jest.fn().mockReturnValue(true) };
    const payloadParser = { parse: jest.fn().mockReturnValue([event]) };
    const webhookInboxRepository = {
      saveIfFirstSeen: jest.fn().mockResolvedValue({ created: true }),
      updateStatus: jest.fn().mockResolvedValue(undefined),
    };
    const idempotencyStore = { tryAcquire: jest.fn().mockResolvedValue(true) };
    const whatsappConfig = {
      shouldStoreWebhookPayloads: jest.fn().mockReturnValue(false),
      getInteractiveEventMaxAgeSeconds: jest.fn().mockReturnValue(60),
      getTextEventMaxAgeSeconds: jest.fn().mockReturnValue(null),
    };
    const auditService = { record: jest.fn().mockResolvedValue(undefined) } as unknown as AuditService;
    const orchestrator = {
      handleEvents: jest.fn().mockResolvedValue(undefined),
    } as unknown as ConversationOrchestratorService;

    const useCase = new ProcessWhatsappWebhookUseCase(
      signatureVerifier,
      payloadParser,
      webhookInboxRepository as any,
      idempotencyStore,
      new WebhookIdempotencyKeyFactory(),
      whatsappConfig as any,
      auditService,
      orchestrator,
    );

    await useCase.execute({
      rawBody: Buffer.from('{}'),
      signatureHeader: 'sha256=test',
      payload: {},
    });

    expect(orchestrator.handleEvents).not.toHaveBeenCalled();
    expect(webhookInboxRepository.updateStatus).toHaveBeenCalledWith(
      expect.objectContaining({
        processingStatus: 'SKIPPED_STALE',
        rejectionReason: 'INTERACTIVE_EVENT_TOO_OLD',
      }),
    );
  });
});
