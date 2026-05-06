import { Injectable, Logger } from '@nestjs/common';
import { AuditEvent } from '../../domain/audit-event';
import { AuditEventWriterPort } from '../../domain/ports/audit-event-writer.port';

@Injectable()
export class LoggerAuditEventWriterAdapter implements AuditEventWriterPort {
  private readonly logger = new Logger(LoggerAuditEventWriterAdapter.name);

  async write(event: AuditEvent): Promise<void> {
    this.logger.log(JSON.stringify(event));
  }
}
