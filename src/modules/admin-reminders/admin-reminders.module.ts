import { Module } from '@nestjs/common';
import { PrismaBotModule } from '../../shared/infrastructure/prisma-bot/prisma-bot.module';
import { AdminAuthModule } from '../admin-auth/admin-auth.module';
import { RemindersModule } from '../reminders/reminders.module';
import { GetAdminReminderMetricsUseCase } from './application/use-cases/get-admin-reminder-metrics.use-case';
import { GetAdminReminderRuntimeOptionsUseCase } from './application/use-cases/get-admin-reminder-runtime-options.use-case';
import { GetAdminReminderRuntimeSettingsUseCase } from './application/use-cases/get-admin-reminder-runtime-settings.use-case';
import { ListAdminReminderRuntimeSettingHistoryUseCase } from './application/use-cases/list-admin-reminder-runtime-setting-history.use-case';
import { ListAdminReminderDispatchesUseCase } from './application/use-cases/list-admin-reminder-dispatches.use-case';
import { ToggleAdminReminderEmergencyPauseUseCase } from './application/use-cases/toggle-admin-reminder-emergency-pause.use-case';
import { UpdateAdminReminderRuntimeSettingsUseCase } from './application/use-cases/update-admin-reminder-runtime-settings.use-case';
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
    GetAdminReminderRuntimeOptionsUseCase,
    GetAdminReminderRuntimeSettingsUseCase,
    ListAdminReminderRuntimeSettingHistoryUseCase,
    ListAdminReminderDispatchesUseCase,
    ToggleAdminReminderEmergencyPauseUseCase,
    UpdateAdminReminderRuntimeSettingsUseCase,
    AdminRemindersMaskingService,
    AdminRemindersQueryParserService,
    {
      provide: ADMIN_REMINDERS_REPOSITORY,
      useClass: PrismaBotAdminRemindersRepository,
    },
  ],
})
export class AdminRemindersModule {}
