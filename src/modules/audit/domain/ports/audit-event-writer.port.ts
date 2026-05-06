import { AuditEvent } from '../audit-event';

export interface AuditEventWriterPort {
  write(event: AuditEvent): Promise<void>;
}
