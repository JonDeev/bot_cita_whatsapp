import { Module } from '@nestjs/common';
import { PrismaBotModule } from '../../shared/infrastructure/prisma-bot/prisma-bot.module';
import { AdminAuthModule } from '../admin-auth/admin-auth.module';
import { RemindersModule } from '../reminders/reminders.module';
import { GetAdminReminderMetricsUseCase } from './application/use-cases/get-admin-reminder-metrics.use-case';
import { ListAdminReminderDispatchesUseCase } from './application/use-cases/list-admin-reminder-dispatches.use-case';
import { AdminRemindersMaskingService } from './application/services/admin-reminders-masking.service';
import { AdminRemindersQueryParserService } from './application/services/admin-reminders-query-parser.service';
import { ADMIN_REMINDERS_REPOSITORY } from './domain/admin-reminders.tokens';
import { PrismaBotAdminRemindersRepository } from './infrastructure/persistence/mysql/prisma-bot-admin-reminders.repository';
import { AdminRemindersController } from './presentation/http/admin-reminders.controller';

@Module({
  imports: [PrismaBotModule, AdminAuthModule, RemindersModule],
  controllers: [AdminRemindersController],
  providers: [
    GetAdminReminderMetricsUseCase,
    ListAdminReminderDispatchesUseCase,
    AdminRemindersMaskingService,
    AdminRemindersQueryParserService,
    {
      provide: ADMIN_REMINDERS_REPOSITORY,
      useClass: PrismaBotAdminRemindersRepository,
    },
  ],
})
export class AdminRemindersModule {}
