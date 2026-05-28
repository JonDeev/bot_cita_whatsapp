import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import type { AdminRole } from '@whatsapp-bot/shared';
import { AdminRoles } from '../../../admin-auth/presentation/http/admin-roles.decorator';
import type { AdminAuthRequest } from '../../../admin-auth/presentation/http/admin-auth-request';
import { CurrentAdminAuth } from '../../../admin-auth/presentation/http/current-admin-auth.decorator';
import { AdminRolesGuard } from '../../../admin-auth/presentation/http/guards/admin-roles.guard';
import { AdminSessionGuard } from '../../../admin-auth/presentation/http/guards/admin-session.guard';
import { GetAdminSurveyMetricsUseCase } from '../../application/use-cases/get-admin-survey-metrics.use-case';
import { ListAdminSurveyDispatchesUseCase } from '../../application/use-cases/list-admin-survey-dispatches.use-case';
import { AdminSurveysQueryParserService } from '../../application/services/admin-surveys-query-parser.service';

const ADMIN_SURVEYS_ROLES: AdminRole[] = ['ADMIN', 'SUPERVISOR'];

@Controller('api/admin/surveys')
@UseGuards(AdminSessionGuard, AdminRolesGuard)
@AdminRoles(...ADMIN_SURVEYS_ROLES)
export class AdminSurveysController {
  constructor(
    private readonly getMetrics: GetAdminSurveyMetricsUseCase,
    private readonly listDispatches: ListAdminSurveyDispatchesUseCase,
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
}
