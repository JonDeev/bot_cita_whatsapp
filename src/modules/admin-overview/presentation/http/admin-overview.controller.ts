import { Controller, Get, UseGuards } from '@nestjs/common';
import type { AdminRole } from '@whatsapp-bot/shared';
import { AdminRoles } from '../../../admin-auth/presentation/http/admin-roles.decorator';
import { AdminSessionGuard } from '../../../admin-auth/presentation/http/guards/admin-session.guard';
import { AdminRolesGuard } from '../../../admin-auth/presentation/http/guards/admin-roles.guard';
import { GetAdminLiveFeedUseCase } from '../../application/use-cases/get-admin-live-feed.use-case';
import { GetAdminOverviewUseCase } from '../../application/use-cases/get-admin-overview.use-case';
import type { AdminOverviewSnapshot } from '../../domain/admin-overview.types';

const ADMIN_OVERVIEW_ROLES: AdminRole[] = ['ADMIN', 'SUPERVISOR'];

@Controller('api/admin')
@UseGuards(AdminSessionGuard, AdminRolesGuard)
@AdminRoles(...ADMIN_OVERVIEW_ROLES)
export class AdminOverviewController {
  constructor(
    private readonly getOverview: GetAdminOverviewUseCase,
    private readonly getLiveFeed: GetAdminLiveFeedUseCase,
  ) {}

  @Get('overview')
  getAdminOverview(): Promise<AdminOverviewSnapshot> {
    return this.getOverview.execute();
  }

  @Get('live-feed')
  getAdminLiveFeed(): Promise<Awaited<ReturnType<GetAdminLiveFeedUseCase['execute']>>> {
    return this.getLiveFeed.execute();
  }
}
