import { Injectable } from '@nestjs/common';
import type { ConversationState } from '../../domain/conversation-state';
import { MainMenuHandler } from '../state-handlers/main-menu.handler';
import { PatientValidatedHandler } from '../state-handlers/patient-validated.handler';
import { ReviewingAssignedAppointmentDetailsHandler } from '../state-handlers/reviewing-assigned-appointment-details.handler';
import { ReviewingAssignedAppointmentActionsHandler } from '../state-handlers/reviewing-assigned-appointment-actions.handler';
import { SelectingAssignedAppointmentHandler } from '../state-handlers/selecting-assigned-appointment.handler';
import { SelectingAppointmentDateHandler } from '../state-handlers/selecting-appointment-date.handler';
import { SelectingAppointmentDoctorHandler } from '../state-handlers/selecting-appointment-doctor.handler';
import { SelectingAppointmentTimeHandler } from '../state-handlers/selecting-appointment-time.handler';
import { SelectingSpecialtyHandler } from '../state-handlers/selecting-specialty.handler';
import { WaitingBirthDateHandler } from '../state-handlers/waiting-birth-date.handler';
import { WaitingDocumentHandler } from '../state-handlers/waiting-document.handler';
import type { ConversationStateHandler } from '../state-handlers/conversation-state-handler';

@Injectable()
export class ConversationStateHandlerResolverService {
  private readonly handlersByState: Map<ConversationState, ConversationStateHandler>;

  constructor(
    mainMenuHandler: MainMenuHandler,
    waitingDocumentHandler: WaitingDocumentHandler,
    waitingBirthDateHandler: WaitingBirthDateHandler,
    patientValidatedHandler: PatientValidatedHandler,
    selectingAssignedAppointmentHandler: SelectingAssignedAppointmentHandler,
    reviewingAssignedAppointmentDetailsHandler: ReviewingAssignedAppointmentDetailsHandler,
    reviewingAssignedAppointmentActionsHandler: ReviewingAssignedAppointmentActionsHandler,
    selectingSpecialtyHandler: SelectingSpecialtyHandler,
    selectingAppointmentDateHandler: SelectingAppointmentDateHandler,
    selectingAppointmentDoctorHandler: SelectingAppointmentDoctorHandler,
    selectingAppointmentTimeHandler: SelectingAppointmentTimeHandler,
  ) {
    this.handlersByState = new Map<ConversationState, ConversationStateHandler>();
    this.handlersByState.set(mainMenuHandler.state, mainMenuHandler);
    this.handlersByState.set(waitingDocumentHandler.state, waitingDocumentHandler);
    this.handlersByState.set(waitingBirthDateHandler.state, waitingBirthDateHandler);
    this.handlersByState.set(patientValidatedHandler.state, patientValidatedHandler);
    this.handlersByState.set(
      selectingAssignedAppointmentHandler.state,
      selectingAssignedAppointmentHandler,
    );
    this.handlersByState.set(
      reviewingAssignedAppointmentDetailsHandler.state,
      reviewingAssignedAppointmentDetailsHandler,
    );
    this.handlersByState.set(
      reviewingAssignedAppointmentActionsHandler.state,
      reviewingAssignedAppointmentActionsHandler,
    );
    this.handlersByState.set(selectingSpecialtyHandler.state, selectingSpecialtyHandler);
    this.handlersByState.set(selectingAppointmentDateHandler.state, selectingAppointmentDateHandler);
    this.handlersByState.set(
      selectingAppointmentDoctorHandler.state,
      selectingAppointmentDoctorHandler,
    );
    this.handlersByState.set(selectingAppointmentTimeHandler.state, selectingAppointmentTimeHandler);
  }

  resolve(state: ConversationState): ConversationStateHandler {
    const handler = this.handlersByState.get(state);
    if (!handler) {
      throw new Error(`No handler registered for conversation state ${state}.`);
    }

    return handler;
  }
}
