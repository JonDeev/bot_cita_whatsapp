import { Module } from '@nestjs/common';
import { PrismaBotModule } from '../../shared/infrastructure/prisma-bot/prisma-bot.module';
import { AdminAuthModule } from '../admin-auth/admin-auth.module';
import { AdminLogsMaskingService } from './application/services/admin-logs-masking.service';
import { AdminLogsQueryParserService } from './application/services/admin-logs-query-parser.service';
import { ListAdminLogAuditUseCase } from './application/use-cases/list-admin-log-audit.use-case';
import { ListAdminLogEventsUseCase } from './application/use-cases/list-admin-log-events.use-case';
import { ListAdminLogFailuresUseCase } from './application/use-cases/list-admin-log-failures.use-case';
import { ADMIN_LOGS_REPOSITORY } from './domain/admin-logs.tokens';
import { PrismaBotAdminLogsRepository } from './infrastructure/persistence/mysql/prisma-bot-admin-logs.repository';
import { AdminLogsController } from './presentation/http/admin-logs.controller';

@Module({
  imports: [PrismaBotModule, AdminAuthModule],
  controllers: [AdminLogsController],
  providers: [
    AdminLogsMaskingService,
    AdminLogsQueryParserService,
    ListAdminLogAuditUseCase,
    ListAdminLogEventsUseCase,
    ListAdminLogFailuresUseCase,
    {
      provide: ADMIN_LOGS_REPOSITORY,
      useClass: PrismaBotAdminLogsRepository,
    },
  ],
})
export class AdminLogsModule {}
