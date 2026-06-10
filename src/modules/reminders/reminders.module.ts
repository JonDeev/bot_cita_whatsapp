import { forwardRef, Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { ConversationsModule } from '../conversations/conversations.module';
import { PatientsModule } from '../patients/patients.module';
import { WhatsappModule } from '../whatsapp/whatsapp.module';
import { PrismaModule } from '../../shared/infrastructure/prisma/prisma.module';
import { PrismaBotModule } from '../../shared/infrastructure/prisma-bot/prisma-bot.module';
import { CreateOrRefreshAppointmentReminderDispatchesUseCase } from './application/use-cases/create-or-refresh-appointment-reminder-dispatches.use-case';
import { DispatchDueAppointmentRemindersUseCase } from './application/use-cases/dispatch-due-appointment-reminders.use-case';
import { HandleAppointmentReminderVerificationReplyUseCase } from './application/use-cases/handle-appointment-reminder-verification-reply.use-case';
import { ConfirmAppointmentReminderPhoneUseCase } from './application/use-cases/confirm-appointment-reminder-phone.use-case';
import { RejectAppointmentReminderPhoneUseCase } from './application/use-cases/reject-appointment-reminder-phone.use-case';
import { ReconcileAppointmentReminderDispatchHealthUseCase } from './application/use-cases/reconcile-appointment-reminder-dispatch-health.use-case';
import { EnqueueDueAppointmentReminderDispatchesUseCase } from './application/use-cases/enqueue-due-appointment-reminder-dispatches.use-case';
import { GetAppointmentReminderMetricsUseCase } from './application/use-cases/get-appointment-reminder-metrics.use-case';
import { AppointmentReminderAppointmentTimeService } from './application/services/appointment-reminder-appointment-time.service';
import { AppointmentReminderBootstrapConfigService } from './application/services/appointment-reminder-bootstrap-config.service';
import { AppointmentReminderButtonTokenService } from './application/services/appointment-reminder-button-token.service';
import { AppointmentReminderDispatchContactDecisionService } from './application/services/appointment-reminder-dispatch-contact-decision.service';
import { AppointmentReminderDispatchConfigService } from './application/services/appointment-reminder-dispatch-config.service';
import { AppointmentReminderMetricsAccessConfigService } from './application/services/appointment-reminder-metrics-access-config.service';
import { AppointmentReminderPhoneNormalizerService } from './application/services/appointment-reminder-phone-normalizer.service';
import { AppointmentReminderSuppressionPolicyService } from './application/services/appointment-reminder-suppression-policy.service';
import { AppointmentReminderRuntimeSettingsCatalogService } from './application/services/appointment-reminder-runtime-settings-catalog.service';
import { AppointmentReminderRuntimeSettingsInitializerService } from './application/services/appointment-reminder-runtime-settings-initializer.service';
import { AppointmentReminderRuntimeSettingsResolverService } from './application/services/appointment-reminder-runtime-settings-resolver.service';
import { AppointmentReminderTemplateConfigService } from './application/services/appointment-reminder-template-config.service';
import { AppointmentReminderTemplateDeliveryService } from './application/services/appointment-reminder-template-delivery.service';
import { AppointmentReminderWindowService } from './application/services/appointment-reminder-window.service';
import { GetAppointmentReminderRuntimeOptionsUseCase } from './application/use-cases/get-appointment-reminder-runtime-options.use-case';
import { GetAppointmentReminderRuntimeSettingsUseCase } from './application/use-cases/get-appointment-reminder-runtime-settings.use-case';
import { ListAppointmentReminderRuntimeSettingEventsUseCase } from './application/use-cases/list-appointment-reminder-runtime-setting-events.use-case';
import { ToggleAppointmentReminderEmergencyPauseUseCase } from './application/use-cases/toggle-appointment-reminder-emergency-pause.use-case';
import { UpdateAppointmentReminderRuntimeSettingsUseCase } from './application/use-cases/update-appointment-reminder-runtime-settings.use-case';
import {
  APPOINTMENT_REMINDER_DISPATCH_REPOSITORY,
  APPOINTMENT_REMINDER_ELIGIBILITY_REPOSITORY,
  APPOINTMENT_REMINDER_METRICS_REPOSITORY,
  APPOINTMENT_REMINDER_OUTBOX_REPOSITORY,
  APPOINTMENT_REMINDER_PATIENT_CONTACT_REPOSITORY,
  APPOINTMENT_REMINDER_RECIPIENT_POLICY_REPOSITORY,
  APPOINTMENT_REMINDER_RUNTIME_SETTINGS_REPOSITORY,
} from './domain/reminders.tokens';
import { MariadbLegacyAppointmentReminderPatientContactRepository } from './infrastructure/persistence/mysql/mariadb-legacy-appointment-reminder-patient-contact.repository';
import { PrismaBotAppointmentReminderDispatchRepository } from './infrastructure/persistence/mysql/prisma-bot-appointment-reminder-dispatch.repository';
import { PrismaBotAppointmentReminderOutboxRepository } from './infrastructure/persistence/mysql/prisma-bot-appointment-reminder-outbox.repository';
import { PrismaBotAppointmentReminderMetricsRepository } from './infrastructure/persistence/mysql/prisma-bot-appointment-reminder-metrics.repository';
import { PrismaBotAppointmentReminderRecipientPolicyRepository } from './infrastructure/persistence/mysql/prisma-bot-appointment-reminder-recipient-policy.repository';
import { PrismaBotAppointmentReminderRuntimeSettingsRepository } from './infrastructure/persistence/mysql/prisma-bot-appointment-reminder-runtime-settings.repository';
import { PrismaLegacyAppointmentReminderEligibilityRepository } from './infrastructure/persistence/mysql/prisma-legacy-appointment-reminder-eligibility.repository';
import { AppointmentReminderScheduler } from './infrastructure/scheduling/appointment-reminder.scheduler';
import { AppointmentReminderSyncScheduler } from './infrastructure/scheduling/appointment-reminder-sync.scheduler';
import { APPOINTMENT_REMINDER_DISPATCH_QUEUE } from './domain/reminder-queue.tokens';
import { BullmqAppointmentReminderDispatchQueue } from './infrastructure/scheduling/bullmq-appointment-reminder-dispatch.queue';
import { BullmqAppointmentReminderDispatchWorker } from './infrastructure/scheduling/bullmq-appointment-reminder-dispatch.worker';
import { InternalAppointmentReminderMetricsController } from './presentation/http/internal-appointment-reminder-metrics.controller';

@Module({
  imports: [
    AuditModule,
    ConversationsModule,
    PatientsModule,
    PrismaModule,
    PrismaBotModule,
    forwardRef(() => WhatsappModule),
  ],
  providers: [
    AppointmentReminderAppointmentTimeService,
    AppointmentReminderBootstrapConfigService,
    AppointmentReminderButtonTokenService,
    AppointmentReminderDispatchContactDecisionService,
    AppointmentReminderDispatchConfigService,
    AppointmentReminderMetricsAccessConfigService,
    AppointmentReminderPhoneNormalizerService,
    AppointmentReminderSuppressionPolicyService,
    AppointmentReminderRuntimeSettingsCatalogService,
    AppointmentReminderRuntimeSettingsInitializerService,
    AppointmentReminderRuntimeSettingsResolverService,
    AppointmentReminderTemplateConfigService,
    AppointmentReminderTemplateDeliveryService,
    AppointmentReminderWindowService,
    PrismaBotAppointmentReminderOutboxRepository,
    CreateOrRefreshAppointmentReminderDispatchesUseCase,
    DispatchDueAppointmentRemindersUseCase,
    HandleAppointmentReminderVerificationReplyUseCase,
    ConfirmAppointmentReminderPhoneUseCase,
    RejectAppointmentReminderPhoneUseCase,
    ReconcileAppointmentReminderDispatchHealthUseCase,
    EnqueueDueAppointmentReminderDispatchesUseCase,
    GetAppointmentReminderMetricsUseCase,
    GetAppointmentReminderRuntimeOptionsUseCase,
    GetAppointmentReminderRuntimeSettingsUseCase,
    ListAppointmentReminderRuntimeSettingEventsUseCase,
    UpdateAppointmentReminderRuntimeSettingsUseCase,
    ToggleAppointmentReminderEmergencyPauseUseCase,
    BullmqAppointmentReminderDispatchQueue,
    BullmqAppointmentReminderDispatchWorker,
    AppointmentReminderScheduler,
    AppointmentReminderSyncScheduler,
    {
      provide: APPOINTMENT_REMINDER_DISPATCH_REPOSITORY,
      useClass: PrismaBotAppointmentReminderDispatchRepository,
    },
    {
      provide: APPOINTMENT_REMINDER_ELIGIBILITY_REPOSITORY,
      useClass: PrismaLegacyAppointmentReminderEligibilityRepository,
    },
    {
      provide: APPOINTMENT_REMINDER_PATIENT_CONTACT_REPOSITORY,
      useClass: MariadbLegacyAppointmentReminderPatientContactRepository,
    },
    {
      provide: APPOINTMENT_REMINDER_RECIPIENT_POLICY_REPOSITORY,
      useClass: PrismaBotAppointmentReminderRecipientPolicyRepository,
    },
    {
      provide: APPOINTMENT_REMINDER_METRICS_REPOSITORY,
      useClass: PrismaBotAppointmentReminderMetricsRepository,
    },
    {
      provide: APPOINTMENT_REMINDER_OUTBOX_REPOSITORY,
      useClass: PrismaBotAppointmentReminderOutboxRepository,
    },
    {
      provide: APPOINTMENT_REMINDER_RUNTIME_SETTINGS_REPOSITORY,
      useClass: PrismaBotAppointmentReminderRuntimeSettingsRepository,
    },
    {
      provide: APPOINTMENT_REMINDER_DISPATCH_QUEUE,
      useExisting: BullmqAppointmentReminderDispatchQueue,
    },
  ],
  controllers: [InternalAppointmentReminderMetricsController],
  exports: [
    HandleAppointmentReminderVerificationReplyUseCase,
    ConfirmAppointmentReminderPhoneUseCase,
    RejectAppointmentReminderPhoneUseCase,
    CreateOrRefreshAppointmentReminderDispatchesUseCase,
    DispatchDueAppointmentRemindersUseCase,
    GetAppointmentReminderMetricsUseCase,
    AppointmentReminderRuntimeSettingsCatalogService,
    AppointmentReminderRuntimeSettingsResolverService,
    GetAppointmentReminderRuntimeOptionsUseCase,
    GetAppointmentReminderRuntimeSettingsUseCase,
    ListAppointmentReminderRuntimeSettingEventsUseCase,
    UpdateAppointmentReminderRuntimeSettingsUseCase,
    ToggleAppointmentReminderEmergencyPauseUseCase,
  ],
})
export class RemindersModule {}
