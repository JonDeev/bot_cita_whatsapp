import { Inject, Injectable } from '@nestjs/common';
import { AdminAuthAuditService } from '../../../admin-auth/application/services/admin-auth-audit.service';
import { ADMIN_SURVEYS_REPOSITORY } from '../../domain/admin-surveys.tokens';
import type {
  AdminSurveysRepository,
  ListAdminSurveyDispatchesQuery,
} from '../../domain/ports/admin-surveys.repository';
import { AdminSurveysMaskingService } from '../services/admin-surveys-masking.service';

@Injectable()
export class ListAdminSurveyDispatchesUseCase {
  constructor(
    @Inject(ADMIN_SURVEYS_REPOSITORY)
    private readonly repository: AdminSurveysRepository,
    private readonly masking: AdminSurveysMaskingService,
    private readonly audit: AdminAuthAuditService,
  ) {}

  async execute(adminUserId: number, query: ListAdminSurveyDispatchesQuery) {
    const result = await this.repository.listDispatches(query);
    await this.audit.write({
      adminUserId,
      action: 'admin.surveys.dispatches_viewed',
      metadata: {
        page: query.page,
        pageSize: query.pageSize,
        status: query.status,
        fromIso: query.fromIso,
        toIso: query.toIso,
      },
    });

    return this.masking.mapDispatches(result);
  }
}
