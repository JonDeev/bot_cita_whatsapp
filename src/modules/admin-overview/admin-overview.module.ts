import { Module } from '@nestjs/common';
import { PrismaBotModule } from '../../shared/infrastructure/prisma-bot/prisma-bot.module';
import { AdminAuthModule } from '../admin-auth/admin-auth.module';
import { GetAdminOverviewUseCase } from './application/use-cases/get-admin-overview.use-case';
import { GetAdminLiveFeedUseCase } from './application/use-cases/get-admin-live-feed.use-case';
import { AdminOverviewConfigService } from './application/services/admin-overview-config.service';
import { ADMIN_OVERVIEW_REPOSITORY } from './domain/admin-overview.tokens';
import { PrismaBotAdminOverviewRepository } from './infrastructure/persistence/mysql/prisma-bot-admin-overview.repository';
import { AdminOverviewController } from './presentation/http/admin-overview.controller';

@Module({
  imports: [PrismaBotModule, AdminAuthModule],
  controllers: [AdminOverviewController],
  providers: [
    AdminOverviewConfigService,
    GetAdminOverviewUseCase,
    GetAdminLiveFeedUseCase,
    {
      provide: ADMIN_OVERVIEW_REPOSITORY,
      useClass: PrismaBotAdminOverviewRepository,
    },
  ],
  exports: [ADMIN_OVERVIEW_REPOSITORY],
})
export class AdminOverviewModule {}
