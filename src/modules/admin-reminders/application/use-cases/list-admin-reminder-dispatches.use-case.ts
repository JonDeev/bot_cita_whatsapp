import { Inject, Injectable } from '@nestjs/common';
import type { AdminRole } from '@whatsapp-bot/shared';
import { AdminAuthAuditService } from '../../../admin-auth/application/services/admin-auth-audit.service';
import { ADMIN_REMINDERS_REPOSITORY } from '../../domain/admin-reminders.tokens';
import type {
  AdminRemindersRepository,
  ListAdminReminderDispatchesQuery,
} from '../../domain/ports/admin-reminders.repository';
import { AdminRemindersMaskingService } from '../services/admin-reminders-masking.service';

@Injectable()
export class ListAdminReminderDispatchesUseCase {
  constructor(
    @Inject(ADMIN_REMINDERS_REPOSITORY)
    private readonly repository: AdminRemindersRepository,
    private readonly masking: AdminRemindersMaskingService,
    private readonly audit: AdminAuthAuditService,
  ) {}

  async execute(
    adminUserId: number,
    role: AdminRole,
    query: ListAdminReminderDispatchesQuery,
  ) {
    const result = await this.repository.listDispatches(query);
    await this.audit.write({
      adminUserId,
      action: 'admin.reminders.dispatches_viewed',
      metadata: {
        page: query.page,
        pageSize: query.pageSize,
        status: query.status,
        fromIso: query.fromIso,
        toIso: query.toIso,
      },
    });

    return this.masking.mapDispatches(role, result);
  }
}
