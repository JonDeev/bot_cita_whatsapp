import { Module } from '@nestjs/common';
import { AppointmentsModule } from '../appointments/appointments.module';
import { AuditModule } from '../audit/audit.module';
import { CONVERSATION_SESSION_REPOSITORY } from './domain/conversations.tokens';
import {
  CONVERSATION_MESSAGE_REPOSITORY,
  CONVERSATION_PERSISTENCE_REPOSITORY,
} from './domain/conversations.tokens';
import { HandleIncomingConversationMessageUseCase } from './application/use-cases/handle-incoming-conversation-message.use-case';
import { ConversationConfigService } from './application/services/conversation-config.service';
import { ConversationKeyFactory } from './application/services/conversation-key.factory';
import { AppointmentAvailabilityMessageFactory } from './application/services/appointment-availability-message.factory';
import { AppointmentAssignmentConfirmationMessageFactory } from './application/services/appointment-assignment-confirmation-message.factory';
import { AssignedAppointmentConsultationDetailsMessageFactory } from './application/services/assigned-appointment-consultation-details-message.factory';
import { AssignedAppointmentDetailsMessageFactory } from './application/services/assigned-appointment-details-message.factory';
import { AssignedAppointmentListFactory } from './application/services/assigned-appointment-list.factory';
import { AppointmentDoctorListFactory } from './application/services/appointment-doctor-list.factory';
import { AppointmentDoctorListPresenterService } from './application/services/appointment-doctor-list-presenter.service';
import { AppointmentDateListFactory } from './application/services/appointment-date-list.factory';
import { AppointmentRescheduleConfirmationMessageFactory } from './application/services/appointment-reschedule-confirmation-message.factory';
import { AppointmentReschedulingTimeSelectionService } from './application/services/appointment-rescheduling-time-selection.service';
import { AppointmentTimeListFactory } from './application/services/appointment-time-list.factory';
import { MainMenuListFactory } from './application/services/main-menu-list.factory';
import { ConversationStatePromptService } from './application/services/conversation-state-prompt.service';
import { SpecialtyListFactory } from './application/services/specialty-list.factory';
import { ConversationNavigationService } from './application/services/conversation-navigation.service';
import { PendingAppointmentBlockMessageFactory } from './application/services/pending-appointment-block-message.factory';
import { MainMenuHandler } from './application/state-handlers/main-menu.handler';
import { PatientValidatedHandler } from './application/state-handlers/patient-validated.handler';
import { ReviewingAssignedAppointmentDetailsHandler } from './application/state-handlers/reviewing-assigned-appointment-details.handler';
import { ReviewingAssignedAppointmentActionsHandler } from './application/state-handlers/reviewing-assigned-appointment-actions.handler';
import { SelectingAssignedAppointmentHandler } from './application/state-handlers/selecting-assigned-appointment.handler';
import { SelectingAppointmentDateHandler } from './application/state-handlers/selecting-appointment-date.handler';
import { SelectingAppointmentDoctorHandler } from './application/state-handlers/selecting-appointment-doctor.handler';
import { SelectingAppointmentTimeHandler } from './application/state-handlers/selecting-appointment-time.handler';
import { SelectingSpecialtyHandler } from './application/state-handlers/selecting-specialty.handler';
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
  imports: [AuditModule, RedisModule, PrismaBotModule, PatientsModule, AppointmentsModule],
  providers: [
    ConversationConfigService,
    ConversationKeyFactory,
    AppointmentAvailabilityMessageFactory,
    AppointmentAssignmentConfirmationMessageFactory,
    AssignedAppointmentConsultationDetailsMessageFactory,
    AssignedAppointmentDetailsMessageFactory,
    AssignedAppointmentListFactory,
    AppointmentDoctorListPresenterService,
    AppointmentDoctorListFactory,
    AppointmentDateListFactory,
    AppointmentRescheduleConfirmationMessageFactory,
    AppointmentReschedulingTimeSelectionService,
    AppointmentTimeListFactory,
    MainMenuListFactory,
    ConversationStatePromptService,
    SpecialtyListFactory,
    ConversationNavigationService,
    PendingAppointmentBlockMessageFactory,
    MainMenuHandler,
    WaitingDocumentHandler,
    WaitingBirthDateHandler,
    PatientValidatedHandler,
    SelectingAssignedAppointmentHandler,
    ReviewingAssignedAppointmentDetailsHandler,
    ReviewingAssignedAppointmentActionsHandler,
    SelectingSpecialtyHandler,
    SelectingAppointmentDateHandler,
    SelectingAppointmentDoctorHandler,
    SelectingAppointmentTimeHandler,
    ConversationStateHandlerResolverService,
    HandleIncomingConversationMessageUseCase,
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
    CONVERSATION_MESSAGE_REPOSITORY,
    CONVERSATION_PERSISTENCE_REPOSITORY,
  ],
})
export class ConversationsModule {}
