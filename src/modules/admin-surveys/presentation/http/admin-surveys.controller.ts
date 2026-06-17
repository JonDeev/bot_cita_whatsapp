import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import type { AdminRole } from '@whatsapp-bot/shared';
import { AdminRoles } from '../../../admin-auth/presentation/http/admin-roles.decorator';
import type { AdminAuthRequest } from '../../../admin-auth/presentation/http/admin-auth-request';
import { CurrentAdminAuth } from '../../../admin-auth/presentation/http/current-admin-auth.decorator';
import { AdminCsrfGuard } from '../../../admin-auth/presentation/http/guards/admin-csrf.guard';
import { AdminRolesGuard } from '../../../admin-auth/presentation/http/guards/admin-roles.guard';
import { AdminSessionGuard } from '../../../admin-auth/presentation/http/guards/admin-session.guard';
import { GetAdminSurveyMetricsUseCase } from '../../application/use-cases/get-admin-survey-metrics.use-case';
import { GetAdminSurveyRuntimeOptionsUseCase } from '../../application/use-cases/get-admin-survey-runtime-options.use-case';
import { GetAdminSurveyRuntimeSettingsUseCase } from '../../application/use-cases/get-admin-survey-runtime-settings.use-case';
import { ListAdminSurveyDispatchesUseCase } from '../../application/use-cases/list-admin-survey-dispatches.use-case';
import { ListAdminSurveyRuntimeSettingHistoryUseCase } from '../../application/use-cases/list-admin-survey-runtime-setting-history.use-case';
import { ToggleAdminSurveyEmergencyPauseUseCase } from '../../application/use-cases/toggle-admin-survey-emergency-pause.use-case';
import { UpdateAdminSurveyRuntimeSettingsUseCase } from '../../application/use-cases/update-admin-survey-runtime-settings.use-case';
import { AdminSurveysQueryParserService } from '../../application/services/admin-surveys-query-parser.service';

const ADMIN_SURVEYS_ROLES: AdminRole[] = ['ADMIN', 'SUPERVISOR'];

@Controller('api/admin/surveys')
@UseGuards(AdminSessionGuard, AdminRolesGuard)
@AdminRoles(...ADMIN_SURVEYS_ROLES)
export class AdminSurveysController {
  constructor(
    private readonly getMetrics: GetAdminSurveyMetricsUseCase,
    private readonly listDispatches: ListAdminSurveyDispatchesUseCase,
    private readonly getRuntimeSettings: GetAdminSurveyRuntimeSettingsUseCase,
    private readonly getRuntimeOptions: GetAdminSurveyRuntimeOptionsUseCase,
    private readonly listRuntimeHistory: ListAdminSurveyRuntimeSettingHistoryUseCase,
    private readonly updateRuntimeSettings: UpdateAdminSurveyRuntimeSettingsUseCase,
    private readonly toggleEmergencyPause: ToggleAdminSurveyEmergencyPauseUseCase,
    private readonly parser: AdminSurveysQueryParserService,
  ) {}

  @Get('metrics')
  getSurveyMetrics(
    @Query('date') date: string | undefined,
    @Query('windowStart') windowStart: string | undefined,
    @Query('windowEnd') windowEnd: string | undefined,
  ) {
    return this.getMetrics.execute({ date, windowStart, windowEnd });
  }

  @Get('dispatches')
  listSurveyDispatches(
    @CurrentAdminAuth() adminAuth: AdminAuthRequest['adminAuth'],
    @Query() query: unknown,
  ) {
    const parsed = this.parser.parseListDispatchesQuery(query);
    return this.listDispatches.execute(adminAuth!.user.id, parsed);
  }

  @Get('settings')
  getSurveyRuntimeSettings(
    @CurrentAdminAuth() adminAuth: AdminAuthRequest['adminAuth'],
  ) {
    return this.getRuntimeSettings.execute(
      adminAuth!.user.id,
      adminAuth!.user.role,
    );
  }

  @Get('settings/options')
  getSurveyRuntimeOptions(
    @CurrentAdminAuth() adminAuth: AdminAuthRequest['adminAuth'],
  ) {
    return this.getRuntimeOptions.execute(
      adminAuth!.user.id,
      adminAuth!.user.role,
    );
  }

  @Get('settings/history')
  listSurveyRuntimeHistory(
    @CurrentAdminAuth() adminAuth: AdminAuthRequest['adminAuth'],
    @Query() query: unknown,
  ) {
    const parsed = this.parser.parseSurveySettingsHistoryQuery(query);
    return this.listRuntimeHistory.execute(
      adminAuth!.user.id,
      adminAuth!.user.role,
      parsed,
    );
  }

  @Patch('settings')
  @UseGuards(AdminCsrfGuard)
  updateSurveyRuntimeSettings(
    @CurrentAdminAuth() adminAuth: AdminAuthRequest['adminAuth'],
    @Body() body: unknown,
  ) {
    const parsed = this.parser.parseSurveyRuntimeSettingsUpdateRequest(body);
    return this.updateRuntimeSettings.execute({
      adminUserId: adminAuth!.user.id,
      adminRole: adminAuth!.user.role,
      ipHash: null,
      request: parsed,
    });
  }

  @Post('settings/emergency-pause')
  @UseGuards(AdminCsrfGuard)
  toggleSurveyEmergencyPause(
    @CurrentAdminAuth() adminAuth: AdminAuthRequest['adminAuth'],
    @Body() body: unknown,
  ) {
    const parsed = this.parser.parseSurveyEmergencyPauseRequest(body);
    return this.toggleEmergencyPause.execute({
      adminUserId: adminAuth!.user.id,
      adminRole: adminAuth!.user.role,
      ipHash: null,
      request: parsed,
    });
  }
}
