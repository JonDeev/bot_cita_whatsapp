import { Module } from '@nestjs/common';
import { AdminOverviewModule } from '../admin-overview/admin-overview.module';
import { AdminAuthModule } from '../admin-auth/admin-auth.module';
import { DashboardStreamPollerService } from './application/services/dashboard-stream-poller.service';
import { DashboardStreamService } from './application/services/dashboard-stream.service';
import { DashboardStreamController } from './presentation/http/dashboard-stream.controller';

@Module({
  imports: [AdminAuthModule, AdminOverviewModule],
  controllers: [DashboardStreamController],
  providers: [DashboardStreamService, DashboardStreamPollerService],
  exports: [DashboardStreamService],
})
export class DashboardStreamModule {}
