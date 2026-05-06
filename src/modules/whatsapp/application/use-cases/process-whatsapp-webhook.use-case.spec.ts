import { UnauthorizedException } from '@nestjs/common';
import { AuditService } from '../../../audit/application/services/audit.service';
import { ConversationOrchestratorService } from '../services/conversation-orchestrator.service';
import { WebhookIdempotencyKeyFactory } from '../services/idempotency/webhook-idempotency-key.factory';
import { ProcessWhatsappWebhookUseCase } from './process-whatsapp-webhook.use-case';
import { NormalizedWhatsappEvent } from '../../domain/events/normalized-whatsapp.event';

describe('ProcessWhatsappWebhookUseCase', () => {
  it('processes only non-duplicate events', async () => {
    const event: NormalizedWhatsappEvent = {
      kind: 'incoming_message_received',
      messageId: 'wamid-1',
      from: '573001112233',
      timestamp: '1711111111',
      messageType: 'text',
      textBody: 'hola',
      phoneNumberId: '123',
    };

    const signatureVerifier = { verifySignature: jest.fn().mockReturnValue(true) };
    const payloadParser = { parse: jest.fn().mockReturnValue([event, event]) };
    const idempotencyStore = {
      tryAcquire: jest.fn().mockResolvedValueOnce(true).mockResolvedValueOnce(false),
    };
    const auditService = { record: jest.fn().mockResolvedValue(undefined) } as unknown as AuditService;
    const orchestrator = {
      handleEvents: jest.fn().mockResolvedValue(undefined),
    } as unknown as ConversationOrchestratorService;

    const useCase = new ProcessWhatsappWebhookUseCase(
      signatureVerifier,
      payloadParser,
      idempotencyStore,
      new WebhookIdempotencyKeyFactory(),
      auditService,
      orchestrator,
    );

    await useCase.execute({
      rawBody: Buffer.from('{}'),
      signatureHeader: 'sha256=test',
      payload: {},
    });

    expect(orchestrator.handleEvents).toHaveBeenCalledWith([event]);
    expect(auditService.record).toHaveBeenCalledTimes(2);
  });

  it('throws when signature is invalid', async () => {
    const signatureVerifier = { verifySignature: jest.fn().mockReturnValue(false) };
    const payloadParser = { parse: jest.fn() };
    const idempotencyStore = { tryAcquire: jest.fn() };
    const auditService = { record: jest.fn() } as unknown as AuditService;
    const orchestrator = { handleEvents: jest.fn() } as unknown as ConversationOrchestratorService;

    const useCase = new ProcessWhatsappWebhookUseCase(
      signatureVerifier,
      payloadParser,
      idempotencyStore,
      new WebhookIdempotencyKeyFactory(),
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
});
