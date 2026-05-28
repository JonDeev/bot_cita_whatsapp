import { Inject, Injectable } from '@nestjs/common';
import { ADMIN_OVERVIEW_REPOSITORY } from '../../domain/admin-overview.tokens';
import type { AdminOverviewSnapshot } from '../../domain/admin-overview.types';
import type { AdminOverviewRepository } from '../../domain/ports/admin-overview.repository';
import { AdminOverviewConfigService } from '../services/admin-overview-config.service';

@Injectable()
export class GetAdminOverviewUseCase {
  constructor(
    @Inject(ADMIN_OVERVIEW_REPOSITORY)
    private readonly repository: AdminOverviewRepository,
    private readonly config: AdminOverviewConfigService,
  ) {}

  async execute(): Promise<AdminOverviewSnapshot> {
    const lookbackHours = this.config.getLookbackHours();
    const now = new Date();
    const windowStart = new Date(now.getTime() - lookbackHours * 60 * 60 * 1000);
    const aggregate = await this.repository.getAggregateCounts(windowStart);

    return {
      generatedAtIso: now.toISOString(),
      lookbackHours,
      inboundMessages: aggregate.inboundMessages,
      outboundMessages: aggregate.outboundMessages,
      outboxFailed: aggregate.outboxFailed,
      webhookFailed: aggregate.webhookFailed,
      activeConversations: aggregate.activeConversations,
      reminderDispatches: aggregate.reminderDispatches,
      surveyDispatches: aggregate.surveyDispatches,
    };
  }
}
