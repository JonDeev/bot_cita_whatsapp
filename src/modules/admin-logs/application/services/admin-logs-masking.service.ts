import { Injectable } from '@nestjs/common';
import type { AdminRole } from '@whatsapp-bot/shared';
import type {
  AdminAuditLogItem,
  AdminFailureLogItem,
  AdminOperationalEventItem,
  PaginatedAdminLogsResult,
} from '../../domain/admin-logs.types';

@Injectable()
export class AdminLogsMaskingService {
  mapEvents(
    role: AdminRole,
    result: PaginatedAdminLogsResult<AdminOperationalEventItem>,
  ) {
    return {
      ...result,
      items: result.items.map((item) => ({
        ...item,
        conversationKey: role === 'ADMIN' ? item.conversationKey : null,
        metadata: role === 'ADMIN' ? item.metadata : null,
      })),
    };
  }

  mapFailures(
    role: AdminRole,
    result: PaginatedAdminLogsResult<AdminFailureLogItem>,
  ) {
    return {
      ...result,
      items: result.items.map((item) => ({
        ...item,
        errorCode: role === 'ADMIN' ? item.errorCode : null,
        errorMessage: role === 'ADMIN' ? item.errorMessage : null,
      })),
    };
  }

  mapAudit(
    role: AdminRole,
    result: PaginatedAdminLogsResult<AdminAuditLogItem>,
  ) {
    return {
      ...result,
      items: result.items.map((item) => ({
        ...item,
        metadata: role === 'ADMIN' ? item.metadata : null,
      })),
    };
  }
}
