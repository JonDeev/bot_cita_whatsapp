export interface AuditEvent {
  action: string;
  occurredAt: string;
  metadata: Record<string, string | number | boolean | null | undefined>;
}
