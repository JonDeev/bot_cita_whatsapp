import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import type { AdminRole } from '@whatsapp-bot/shared';
import { AdminRoles } from '../../../admin-auth/presentation/http/admin-roles.decorator';
import type { AdminAuthRequest } from '../../../admin-auth/presentation/http/admin-auth-request';
import { CurrentAdminAuth } from '../../../admin-auth/presentation/http/current-admin-auth.decorator';
import { AdminRolesGuard } from '../../../admin-auth/presentation/http/guards/admin-roles.guard';
import { AdminSessionGuard } from '../../../admin-auth/presentation/http/guards/admin-session.guard';
import { GetAdminReminderMetricsUseCase } from '../../application/use-cases/get-admin-reminder-metrics.use-case';
import { ListAdminReminderDispatchesUseCase } from '../../application/use-cases/list-admin-reminder-dispatches.use-case';
import { AdminRemindersQueryParserService } from '../../application/services/admin-reminders-query-parser.service';

const ADMIN_REMINDERS_ROLES: AdminRole[] = ['ADMIN', 'SUPERVISOR'];

@Controller('api/admin/reminders')
@UseGuards(AdminSessionGuard, AdminRolesGuard)
@AdminRoles(...ADMIN_REMINDERS_ROLES)
export class AdminRemindersController {
  constructor(
    private readonly getMetrics: GetAdminReminderMetricsUseCase,
    private readonly listDispatches: ListAdminReminderDispatchesUseCase,
    private readonly parser: AdminRemindersQueryParserService,
  ) {}

  @Get('metrics')
  getReminderMetrics(
    @Query('lookbackHours') lookbackHoursRaw: string | undefined,
  ) {
    const lookbackHours = this.parser.parseMetricsLookbackHours(lookbackHoursRaw);
    return this.getMetrics.execute(lookbackHours);
  }

  @Get('dispatches')
  listReminderDispatches(
    @CurrentAdminAuth() adminAuth: AdminAuthRequest['adminAuth'],
    @Query() query: unknown,
  ) {
    const parsed = this.parser.parseListDispatchesQuery(query);
    return this.listDispatches.execute(
      adminAuth!.user.id,
      adminAuth!.user.role,
      parsed,
    );
  }
}
