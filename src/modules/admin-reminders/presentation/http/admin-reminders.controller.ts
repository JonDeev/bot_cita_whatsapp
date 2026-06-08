import { Body, Controller, Get, Patch, Post, Query, UseGuards } from '@nestjs/common';
import type { AdminRole } from '@whatsapp-bot/shared';
import { AdminRoles } from '../../../admin-auth/presentation/http/admin-roles.decorator';
import type { AdminAuthRequest } from '../../../admin-auth/presentation/http/admin-auth-request';
import { CurrentAdminAuth } from '../../../admin-auth/presentation/http/current-admin-auth.decorator';
import { AdminCsrfGuard } from '../../../admin-auth/presentation/http/guards/admin-csrf.guard';
import { AdminRolesGuard } from '../../../admin-auth/presentation/http/guards/admin-roles.guard';
import { AdminSessionGuard } from '../../../admin-auth/presentation/http/guards/admin-session.guard';
import { GetAdminReminderRuntimeOptionsUseCase } from '../../application/use-cases/get-admin-reminder-runtime-options.use-case';
import { GetAdminReminderRuntimeSettingsUseCase } from '../../application/use-cases/get-admin-reminder-runtime-settings.use-case';
import { GetAdminReminderMetricsUseCase } from '../../application/use-cases/get-admin-reminder-metrics.use-case';
import { ListAdminReminderRuntimeSettingHistoryUseCase } from '../../application/use-cases/list-admin-reminder-runtime-setting-history.use-case';
import { ListAdminReminderDispatchesUseCase } from '../../application/use-cases/list-admin-reminder-dispatches.use-case';
import { ToggleAdminReminderEmergencyPauseUseCase } from '../../application/use-cases/toggle-admin-reminder-emergency-pause.use-case';
import { UpdateAdminReminderRuntimeSettingsUseCase } from '../../application/use-cases/update-admin-reminder-runtime-settings.use-case';
import { AdminRemindersQueryParserService } from '../../application/services/admin-reminders-query-parser.service';

const ADMIN_REMINDERS_ROLES: AdminRole[] = ['ADMIN', 'SUPERVISOR'];

@Controller('api/admin/reminders')
@UseGuards(AdminSessionGuard, AdminRolesGuard)
@AdminRoles(...ADMIN_REMINDERS_ROLES)
export class AdminRemindersController {
  constructor(
    private readonly getMetrics: GetAdminReminderMetricsUseCase,
    private readonly listDispatches: ListAdminReminderDispatchesUseCase,
    private readonly getRuntimeSettings: GetAdminReminderRuntimeSettingsUseCase,
    private readonly getRuntimeOptions: GetAdminReminderRuntimeOptionsUseCase,
    private readonly listRuntimeHistory: ListAdminReminderRuntimeSettingHistoryUseCase,
    private readonly updateRuntimeSettings: UpdateAdminReminderRuntimeSettingsUseCase,
    private readonly toggleEmergencyPause: ToggleAdminReminderEmergencyPauseUseCase,
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

  @Get('settings')
  getReminderRuntimeSettings(
    @CurrentAdminAuth() adminAuth: AdminAuthRequest['adminAuth'],
  ) {
    return this.getRuntimeSettings.execute(
      adminAuth!.user.id,
      adminAuth!.user.role,
    );
  }

  @Get('settings/options')
  getReminderRuntimeOptions(
    @CurrentAdminAuth() adminAuth: AdminAuthRequest['adminAuth'],
  ) {
    return this.getRuntimeOptions.execute(adminAuth!.user.id);
  }

  @Get('settings/history')
  listReminderRuntimeHistory(
    @CurrentAdminAuth() adminAuth: AdminAuthRequest['adminAuth'],
    @Query() query: unknown,
  ) {
    const parsed = this.parser.parseReminderSettingsHistoryQuery(query);
    return this.listRuntimeHistory.execute(
      adminAuth!.user.id,
      adminAuth!.user.role,
      parsed,
    );
  }

  @Patch('settings')
  @UseGuards(AdminCsrfGuard)
  updateReminderRuntimeSettings(
    @CurrentAdminAuth() adminAuth: AdminAuthRequest['adminAuth'],
    @Body() body: unknown,
  ) {
    const parsed = this.parser.parseReminderRuntimeSettingsUpdateRequest(body);
    return this.updateRuntimeSettings.execute({
      adminUserId: adminAuth!.user.id,
      adminRole: adminAuth!.user.role,
      ipHash: null,
      request: parsed,
    });
  }

  @Post('settings/emergency-pause')
  @UseGuards(AdminCsrfGuard)
  toggleReminderEmergencyPause(
    @CurrentAdminAuth() adminAuth: AdminAuthRequest['adminAuth'],
    @Body() body: unknown,
  ) {
    const parsed = this.parser.parseEmergencyPauseRequest(body);
    return this.toggleEmergencyPause.execute({
      adminUserId: adminAuth!.user.id,
      adminRole: adminAuth!.user.role,
      ipHash: null,
      expectedVersion: parsed.expectedVersion,
      reason: parsed.reason,
      enabled: parsed.enabled,
    });
  }
}
