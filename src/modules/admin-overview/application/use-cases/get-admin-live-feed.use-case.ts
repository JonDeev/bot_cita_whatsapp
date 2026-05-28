import { Inject, Injectable } from '@nestjs/common';
import { ADMIN_OVERVIEW_REPOSITORY } from '../../domain/admin-overview.tokens';
import type { AdminLiveFeedItem } from '../../domain/admin-overview.types';
import type { AdminOverviewRepository } from '../../domain/ports/admin-overview.repository';
import { AdminOverviewConfigService } from '../services/admin-overview-config.service';

export interface GetAdminLiveFeedResult {
  generatedAtIso: string;
  lookbackHours: number;
  limit: number;
  items: AdminLiveFeedItem[];
}

@Injectable()
export class GetAdminLiveFeedUseCase {
  constructor(
    @Inject(ADMIN_OVERVIEW_REPOSITORY)
    private readonly repository: AdminOverviewRepository,
    private readonly config: AdminOverviewConfigService,
  ) {}

  async execute(): Promise<GetAdminLiveFeedResult> {
    const lookbackHours = this.config.getLookbackHours();
    const limit = this.config.getLiveFeedLimit();
    const now = new Date();
    const windowStart = new Date(now.getTime() - lookbackHours * 60 * 60 * 1000);
    const items = await this.repository.getRecentLiveFeed(windowStart, limit);

    return {
      generatedAtIso: now.toISOString(),
      lookbackHours,
      limit,
      items,
    };
  }
}
