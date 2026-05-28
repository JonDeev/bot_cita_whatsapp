import { Inject, Injectable } from '@nestjs/common';
import { ADMIN_AUTH_AUDIT_REPOSITORY } from '../../domain/admin-auth.tokens';
import type { AdminAuthAuditRepository } from '../../domain/ports/admin-auth-audit.repository';

export interface AdminAuthAuditEventInput {
  adminUserId?: number | null;
  action: string;
  resourceType?: string | null;
  resourceId?: string | null;
  metadata?: Record<string, string | number | boolean | null>;
  ipHash?: string | null;
}

@Injectable()
export class AdminAuthAuditService {
  constructor(
    @Inject(ADMIN_AUTH_AUDIT_REPOSITORY)
    private readonly auditRepository: AdminAuthAuditRepository,
  ) {}

  async write(input: AdminAuthAuditEventInput): Promise<void> {
    await this.auditRepository.create({
      adminUserId: input.adminUserId ?? null,
      action: input.action,
      resourceType: input.resourceType ?? null,
      resourceId: input.resourceId ?? null,
      metadata: input.metadata ?? {},
      ipHash: input.ipHash ?? null,
      occurredAtIso: new Date().toISOString(),
    });
  }
}
