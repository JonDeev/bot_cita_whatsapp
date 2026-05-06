import { Injectable, Logger } from '@nestjs/common';
import type { AuditEvent } from '../../domain/audit-event';
import type { AuditEventWriterPort } from '../../domain/ports/audit-event-writer.port';
import { LoggerAuditEventWriterAdapter } from './logger-audit-event-writer.adapter';
import { PrismaBotAuditEventWriterAdapter } from '../persistence/mysql/prisma-bot-audit-event-writer.adapter';

@Injectable()
export class CompositeAuditEventWriterAdapter implements AuditEventWriterPort {
  private readonly logger = new Logger(CompositeAuditEventWriterAdapter.name);

  constructor(
    private readonly loggerWriter: LoggerAuditEventWriterAdapter,
    private readonly prismaWriter: PrismaBotAuditEventWriterAdapter,
  ) {}

  async write(event: AuditEvent): Promise<void> {
    await this.loggerWriter.write(event);

    try {
      await this.prismaWriter.write(event);
    } catch (error) {
      this.logger.error(
        `Failed to persist audit event in bot database. action=${event.action}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }
}
