import { CompositeAuditEventWriterAdapter } from './composite-audit-event-writer.adapter';
import { LoggerAuditEventWriterAdapter } from './logger-audit-event-writer.adapter';
import { PrismaBotAuditEventWriterAdapter } from '../persistence/mysql/prisma-bot-audit-event-writer.adapter';

describe('CompositeAuditEventWriterAdapter', () => {
  it('writes audit events to both sinks', async () => {
    const loggerWriter = {
      write: jest.fn().mockResolvedValue(undefined),
    } as unknown as LoggerAuditEventWriterAdapter;
    const prismaWriter = {
      write: jest.fn().mockResolvedValue(undefined),
    } as unknown as PrismaBotAuditEventWriterAdapter;

    const adapter = new CompositeAuditEventWriterAdapter(
      loggerWriter,
      prismaWriter,
    );

    await adapter.write({
      action: 'conversation.session.created',
      occurredAt: '2026-05-04T10:00:00.000Z',
      metadata: { conversationKey: 'whatsapp:123:573001112233' },
    });

    expect(loggerWriter.write).toHaveBeenCalledTimes(1);
    expect(prismaWriter.write).toHaveBeenCalledTimes(1);
  });
});
