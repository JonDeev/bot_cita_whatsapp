import { Inject, Injectable } from '@nestjs/common';
import type { AdminRole } from '@whatsapp-bot/shared';
import { AdminAuthAuditService } from '../../../admin-auth/application/services/admin-auth-audit.service';
import { ADMIN_LOGS_REPOSITORY } from '../../domain/admin-logs.tokens';
import type {
  AdminLogsRepository,
  ListAdminEventsQuery,
} from '../../domain/ports/admin-logs.repository';
import { AdminLogsMaskingService } from '../services/admin-logs-masking.service';

@Injectable()
export class ListAdminLogEventsUseCase {
  constructor(
    @Inject(ADMIN_LOGS_REPOSITORY)
    private readonly repository: AdminLogsRepository,
    private readonly masking: AdminLogsMaskingService,
    private readonly audit: AdminAuthAuditService,
  ) {}

  async execute(adminUserId: number, role: AdminRole, query: ListAdminEventsQuery) {
    const result = await this.repository.listEvents(query);

    await this.audit.write({
      adminUserId,
      action: 'admin.logs.events_viewed',
      metadata: {
        page: query.page,
        pageSize: query.pageSize,
        action: query.action,
        fromIso: query.fromIso,
        toIso: query.toIso,
      },
    });

    return this.masking.mapEvents(role, result);
  }
}
