import { PrismaBotService } from '../../../../../shared/infrastructure/prisma-bot/prisma-bot.service';
import { PrismaBotAuditEventWriterAdapter } from './prisma-bot-audit-event-writer.adapter';

describe('PrismaBotAuditEventWriterAdapter', () => {
  it('persists audit events in bot_audit_events and links conversation when possible', async () => {
    const prismaBot = {
      botConversation: {
        findUnique: jest.fn().mockResolvedValue({ id: 7 }),
      },
      botAuditEvent: {
        create: jest.fn().mockResolvedValue(undefined),
      },
    } as unknown as PrismaBotService;

    const adapter = new PrismaBotAuditEventWriterAdapter(prismaBot);

    await adapter.write({
      action: 'conversation.state.changed',
      occurredAt: '2026-05-04T10:00:00.000Z',
      metadata: {
        conversationKey: 'whatsapp:123:573001112233',
        nextState: 'MAIN_MENU',
      },
    });

    expect(prismaBot.botConversation.findUnique).toHaveBeenCalledTimes(1);
    expect(prismaBot.botAuditEvent.create).toHaveBeenCalledTimes(1);
  });
});
