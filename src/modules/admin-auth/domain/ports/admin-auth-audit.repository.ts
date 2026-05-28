export interface CreateAdminAuditEventInput {
  adminUserId: number | null;
  action: string;
  resourceType: string | null;
  resourceId: string | null;
  metadata: Record<string, string | number | boolean | null>;
  ipHash: string | null;
  occurredAtIso: string;
}

export interface AdminAuthAuditRepository {
  create(event: CreateAdminAuditEventInput): Promise<void>;
}
