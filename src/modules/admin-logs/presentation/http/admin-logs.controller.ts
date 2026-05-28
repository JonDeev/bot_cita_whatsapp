import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import type { AdminRole } from '@whatsapp-bot/shared';
import type { AdminAuthRequest } from '../../../admin-auth/presentation/http/admin-auth-request';
import { AdminRoles } from '../../../admin-auth/presentation/http/admin-roles.decorator';
import { CurrentAdminAuth } from '../../../admin-auth/presentation/http/current-admin-auth.decorator';
import { AdminRolesGuard } from '../../../admin-auth/presentation/http/guards/admin-roles.guard';
import { AdminSessionGuard } from '../../../admin-auth/presentation/http/guards/admin-session.guard';
import { AdminLogsQueryParserService } from '../../application/services/admin-logs-query-parser.service';
import { ListAdminLogAuditUseCase } from '../../application/use-cases/list-admin-log-audit.use-case';
import { ListAdminLogEventsUseCase } from '../../application/use-cases/list-admin-log-events.use-case';
import { ListAdminLogFailuresUseCase } from '../../application/use-cases/list-admin-log-failures.use-case';

const ADMIN_LOGS_ROLES: AdminRole[] = ['ADMIN', 'SUPERVISOR'];

@Controller('api/admin/logs')
@UseGuards(AdminSessionGuard, AdminRolesGuard)
@AdminRoles(...ADMIN_LOGS_ROLES)
export class AdminLogsController {
  constructor(
    private readonly parser: AdminLogsQueryParserService,
    private readonly listEvents: ListAdminLogEventsUseCase,
    private readonly listFailures: ListAdminLogFailuresUseCase,
    private readonly listAudit: ListAdminLogAuditUseCase,
  ) {}

  @Get('events')
  listOperationalEvents(
    @CurrentAdminAuth() adminAuth: AdminAuthRequest['adminAuth'],
    @Query() query: unknown,
  ) {
    const parsed = this.parser.parseEventsQuery(query);
    return this.listEvents.execute(adminAuth!.user.id, adminAuth!.user.role, parsed);
  }

  @Get('failures')
  listFailureEvents(
    @CurrentAdminAuth() adminAuth: AdminAuthRequest['adminAuth'],
    @Query() query: unknown,
  ) {
    const parsed = this.parser.parseFailuresQuery(query);
    return this.listFailures.execute(
      adminAuth!.user.id,
      adminAuth!.user.role,
      parsed,
    );
  }

  @Get('audit')
  listAuditEvents(
    @CurrentAdminAuth() adminAuth: AdminAuthRequest['adminAuth'],
    @Query() query: unknown,
  ) {
    const parsed = this.parser.parseAuditQuery(query);
    return this.listAudit.execute(adminAuth!.user.id, adminAuth!.user.role, parsed);
  }
}
