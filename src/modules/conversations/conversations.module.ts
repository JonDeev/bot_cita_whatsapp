import { Module } from '@nestjs/common';
import { AppointmentsModule } from '../appointments/appointments.module';
import { AuditModule } from '../audit/audit.module';
import { CONVERSATION_SESSION_REPOSITORY } from './domain/conversations.tokens';
import {
  CONVERSATION_MESSAGE_REPOSITORY,
  CONVERSATION_PERSISTENCE_REPOSITORY,
} from './domain/conversations.tokens';
import { HandleIncomingConversationMessageUseCase } from './application/use-cases/handle-incoming-conversation-message.use-case';
import { ReconcileConversationIdlePolicyUseCase } from './application/use-cases/reconcile-conversation-idle-policy.use-case';
import { ConversationConfigService } from './application/services/conversation-config.service';
import { ConversationIdlePolicyConfigService } from './application/services/conversation-idle-policy-config.service';
import { ConversationKeyFactory } from './application/services/conversation-key.factory';
import { AppointmentAvailabilityMessageFactory } from './application/services/appointment-availability-message.factory';
import { AppointmentAssignmentConfirmationMessageFactory } from './application/services/appointment-assignment-confirmation-message.factory';
import { AssignedAppointmentConsultationDetailsMessageFactory } from './application/services/assigned-appointment-consultation-details-message.factory';
import { AssignedAppointmentDetailsMessageFactory } from './application/services/assigned-appointment-details-message.factory';
import { AssignedAppointmentListFactory } from './application/services/assigned-appointment-list.factory';
import { AppointmentDoctorListFactory } from './application/services/appointment-doctor-list.factory';
import { AppointmentDoctorListPresenterService } from './application/services/appointment-doctor-list-presenter.service';
import { AppointmentDateListFactory } from './application/services/appointment-date-list.factory';
import { AppointmentNotificationOptInMessageFactory } from './application/services/appointment-notification-opt-in-message.factory';
import { AppointmentRescheduleConfirmationMessageFactory } from './application/services/appointment-reschedule-confirmation-message.factory';
import { AppointmentReschedulingTimeSelectionService } from './application/services/appointment-rescheduling-time-selection.service';
import { AppointmentTimeListFactory } from './application/services/appointment-time-list.factory';
import { AssignedDispensaryMessageFactory } from './application/services/assigned-dispensary-message.factory';
import { MainMenuListFactory } from './application/services/main-menu-list.factory';
import { PatientContactConfirmationMessageFactory } from './application/services/patient-contact-confirmation-message.factory';
import { PatientContactUpdateOptionsListFactory } from './application/services/patient-contact-update-options-list.factory';
import { PatientContactUpdateSuccessMessageFactory } from './application/services/patient-contact-update-success-message.factory';
import { ConversationStatePromptService } from './application/services/conversation-state-prompt.service';
import { ConsentPhoneResolverService } from './application/services/consent-phone-resolver.service';
import { InteractivePromptWindowService } from './application/services/interactive-prompt-window.service';
import { SpecialtyListFactory } from './application/services/specialty-list.factory';
import { ConversationNavigationService } from './application/services/conversation-navigation.service';
import { ContactUpdateCompletionService } from './application/services/contact-update-completion.service';
import { PatientContactRevalidationPolicyService } from './application/services/patient-contact-revalidation-policy.service';
import { PrimaryFlowContinuationResolverService } from './application/services/primary-flow-continuation-resolver.service';
import { PendingAppointmentBlockMessageFactory } from './application/services/pending-appointment-block-message.factory';
import { ConfirmingPatientContactHandler } from './application/state-handlers/confirming-patient-contact.handler';
import { MainMenuHandler } from './application/state-handlers/main-menu.handler';
import { PatientValidatedHandler } from './application/state-handlers/patient-validated.handler';
import { ReviewingAssignedAppointmentDetailsHandler } from './application/state-handlers/reviewing-assigned-appointment-details.handler';
import { ReviewingAssignedAppointmentActionsHandler } from './application/state-handlers/reviewing-assigned-appointment-actions.handler';
import { RequestingWhatsappAppointmentNotificationsOptInHandler } from './application/state-handlers/requesting-whatsapp-appointment-notifications-opt-in.handler';
import { SelectingContactUpdateFieldHandler } from './application/state-handlers/selecting-contact-update-field.handler';
import { SelectingAssignedAppointmentHandler } from './application/state-handlers/selecting-assigned-appointment.handler';
import { SelectingAppointmentDateHandler } from './application/state-handlers/selecting-appointment-date.handler';
import { SelectingAppointmentDoctorHandler } from './application/state-handlers/selecting-appointment-doctor.handler';
import { SelectingAppointmentTimeHandler } from './application/state-handlers/selecting-appointment-time.handler';
import { SelectingSpecialtyHandler } from './application/state-handlers/selecting-specialty.handler';
import { UpdatingContactEmailHandler } from './application/state-handlers/updating-contact-email.handler';
import { UpdatingContactPhoneHandler } from './application/state-handlers/updating-contact-phone.handler';
import { WaitingBirthDateHandler } from './application/state-handlers/waiting-birth-date.handler';
import { WaitingDocumentHandler } from './application/state-handlers/waiting-document.handler';
import { ConversationStateHandlerResolverService } from './application/services/conversation-state-handler-resolver.service';
import { RedisConversationSessionRepository } from './infrastructure/persistence/redis/redis-conversation-session.repository';
import { RedisModule } from '../../shared/infrastructure/redis/redis.module';
import { PrismaBotModule } from '../../shared/infrastructure/prisma-bot/prisma-bot.module';
import { PrismaBotConversationPersistenceRepository } from './infrastructure/persistence/mysql/prisma-bot-conversation-persistence.repository';
import { PrismaBotConversationMessageRepository } from './infrastructure/persistence/mysql/prisma-bot-conversation-message.repository';
import { PatientsModule } from '../patients/patients.module';

@Module({
  imports: [
    AuditModule,
    RedisModule,
    PrismaBotModule,
    PatientsModule,
    AppointmentsModule,
  ],
  providers: [
    ConversationConfigService,
    ConversationIdlePolicyConfigService,
    ConversationKeyFactory,
    AppointmentAvailabilityMessageFactory,
    AppointmentAssignmentConfirmationMessageFactory,
    AssignedAppointmentConsultationDetailsMessageFactory,
    AssignedAppointmentDetailsMessageFactory,
    AssignedAppointmentListFactory,
    AppointmentDoctorListPresenterService,
    AppointmentDoctorListFactory,
    AppointmentDateListFactory,
    AppointmentNotificationOptInMessageFactory,
    AppointmentRescheduleConfirmationMessageFactory,
    AppointmentReschedulingTimeSelectionService,
    AppointmentTimeListFactory,
    AssignedDispensaryMessageFactory,
    MainMenuListFactory,
    PatientContactConfirmationMessageFactory,
    PatientContactUpdateOptionsListFactory,
    PatientContactUpdateSuccessMessageFactory,
    ConversationStatePromptService,
    ConsentPhoneResolverService,
    InteractivePromptWindowService,
    SpecialtyListFactory,
    ConversationNavigationService,
    ContactUpdateCompletionService,
    PatientContactRevalidationPolicyService,
    PrimaryFlowContinuationResolverService,
    PendingAppointmentBlockMessageFactory,
    MainMenuHandler,
    WaitingDocumentHandler,
    WaitingBirthDateHandler,
    PatientValidatedHandler,
    ConfirmingPatientContactHandler,
    SelectingContactUpdateFieldHandler,
    UpdatingContactPhoneHandler,
    UpdatingContactEmailHandler,
    SelectingAssignedAppointmentHandler,
    ReviewingAssignedAppointmentDetailsHandler,
    ReviewingAssignedAppointmentActionsHandler,
    RequestingWhatsappAppointmentNotificationsOptInHandler,
    SelectingSpecialtyHandler,
    SelectingAppointmentDateHandler,
    SelectingAppointmentDoctorHandler,
    SelectingAppointmentTimeHandler,
    ConversationStateHandlerResolverService,
    HandleIncomingConversationMessageUseCase,
    ReconcileConversationIdlePolicyUseCase,
    {
      provide: CONVERSATION_SESSION_REPOSITORY,
      useClass: RedisConversationSessionRepository,
    },
    {
      provide: CONVERSATION_PERSISTENCE_REPOSITORY,
      useClass: PrismaBotConversationPersistenceRepository,
    },
    {
      provide: CONVERSATION_MESSAGE_REPOSITORY,
      useClass: PrismaBotConversationMessageRepository,
    },
  ],
  exports: [
    HandleIncomingConversationMessageUseCase,
    ReconcileConversationIdlePolicyUseCase,
    ConversationKeyFactory,
    CONVERSATION_MESSAGE_REPOSITORY,
    CONVERSATION_PERSISTENCE_REPOSITORY,
  ],
})
export class ConversationsModule {}
