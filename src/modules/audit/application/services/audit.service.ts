import { Inject, Injectable } from '@nestjs/common';
import { AuditEvent } from '../../domain/audit-event';
import type { AuditEventWriterPort } from '../../domain/ports/audit-event-writer.port';
import { AUDIT_EVENT_WRITER } from '../../domain/audit.tokens';

@Injectable()
export class AuditService {
  constructor(
    @Inject(AUDIT_EVENT_WRITER)
    private readonly eventWriter: AuditEventWriterPort,
  ) {}

  async record(
    action: string,
    metadata: Record<string, string | number | boolean | null | undefined>,
  ): Promise<void> {
    const event: AuditEvent = {
      action,
      occurredAt: new Date().toISOString(),
      metadata,
    };

    await this.eventWriter.write(event);
  }
}
