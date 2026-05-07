import { PrismaBotService } from '../../../../../shared/infrastructure/prisma-bot/prisma-bot.service';
import { PrismaBotWebhookInboxRepository } from './prisma-bot-webhook-inbox.repository';

describe('PrismaBotWebhookInboxRepository', () => {
  it('creates a durable inbox row the first time an event is seen', async () => {
    const prismaBot = {
      botWebhookEvent: {
        create: jest.fn().mockResolvedValue(undefined),
        update: jest.fn().mockResolvedValue(undefined),
      },
    } as unknown as PrismaBotService;

    const repository = new PrismaBotWebhookInboxRepository(prismaBot);

    await expect(
      repository.saveIfFirstSeen({
        deduplicationKey: 'incoming:wamid-1',
        providerMessageId: 'wamid-1',
        eventKind: 'incoming_message_received',
        phoneNumberId: '123',
        participantPhone: '573001112233',
        messageType: 'interactive',
        interactiveReplyId: 'main_menu_request_appointment',
        contextMessageId: 'wamid-outbound-1',
        providerOccurredAt: '2026-05-04T16:17:47.000Z',
        receivedAt: '2026-05-07T12:44:15.000Z',
        signatureValid: true,
        payloadHash: 'hash',
        payload: { entry: [] },
      }),
    ).resolves.toEqual({ created: true });
  });

  it('updates processing status for a stored webhook event', async () => {
    const prismaBot = {
      botWebhookEvent: {
        create: jest.fn().mockResolvedValue(undefined),
        update: jest.fn().mockResolvedValue(undefined),
      },
    } as unknown as PrismaBotService;

    const repository = new PrismaBotWebhookInboxRepository(prismaBot);

    await repository.updateStatus({
      deduplicationKey: 'incoming:wamid-1',
      processingStatus: 'PROCESSED',
      processedAt: '2026-05-07T12:44:16.000Z',
      rejectionReason: null,
      errorMessage: null,
    });

    expect(prismaBot.botWebhookEvent.update).toHaveBeenCalledTimes(1);
  });
});
