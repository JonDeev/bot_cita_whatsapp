import { BotOutboxStatus } from '@whatsapp-bot/prisma-client';
import type { PrismaBotService } from '../../../../../shared/infrastructure/prisma-bot/prisma-bot.service';
import { PrismaBotAppointmentReminderOutboxRepository } from './prisma-bot-appointment-reminder-outbox.repository';

type UpsertInput = Parameters<
  PrismaBotService['botOutboxMessage']['upsert']
>[0];
type UpdateManyInput = Parameters<
  PrismaBotService['botOutboxMessage']['updateMany']
>[0];

describe('PrismaBotAppointmentReminderOutboxRepository', () => {
  it('reserves, marks sent and marks failed reminder outbox records', async () => {
    const upsert = jest.fn<Promise<unknown>, [UpsertInput]>();
    upsert.mockResolvedValue(undefined);
    const updateMany = jest.fn<Promise<unknown>, [UpdateManyInput]>();
    updateMany.mockResolvedValue(undefined);

    const prismaBot = {
      botOutboxMessage: {
        upsert,
        updateMany,
      },
    } as unknown as PrismaBotService;

    const repository = new PrismaBotAppointmentReminderOutboxRepository(
      prismaBot,
    );

    await repository.reserve({
      deduplicationKey: 'appointment-reminder:1:recordatorio:dispatch_due',
      conversationKey: 'whatsapp:1:573001234567',
      recipientPhone: '573001234567',
      payload: { kind: 'test' },
    });

    await repository.markSent({
      deduplicationKey: 'appointment-reminder:1:recordatorio:dispatch_due',
      payload: { kind: 'test', messageId: 'wamid-1' },
      sentAtIso: '2026-06-05T10:00:00.000Z',
    });

    await repository.markFailed({
      deduplicationKey: 'appointment-reminder:1:recordatorio:dispatch_due',
      errorMessage: 'boom',
    });

    expect(upsert.mock.calls[0]?.[0]).toMatchObject({
      where: {
        deduplicationKey: 'appointment-reminder:1:recordatorio:dispatch_due',
      },
      create: {
        channel: 'whatsapp',
        recipientPhone: '573001234567',
        status: BotOutboxStatus.PENDING,
      },
    });

    expect(updateMany.mock.calls[0]?.[0]).toMatchObject({
      where: {
        deduplicationKey: 'appointment-reminder:1:recordatorio:dispatch_due',
      },
      data: {
        status: BotOutboxStatus.SENT,
      },
    });

    expect(updateMany.mock.calls[1]?.[0]).toMatchObject({
      where: {
        deduplicationKey: 'appointment-reminder:1:recordatorio:dispatch_due',
      },
      data: {
        status: BotOutboxStatus.FAILED,
        errorMessage: 'boom',
      },
    });
  });
});
