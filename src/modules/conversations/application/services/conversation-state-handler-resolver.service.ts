import { Injectable } from '@nestjs/common';
import type { ConversationState } from '../../domain/conversation-state';
import { MainMenuHandler } from '../state-handlers/main-menu.handler';
import { PatientValidatedHandler } from '../state-handlers/patient-validated.handler';
import { SelectingAppointmentDateHandler } from '../state-handlers/selecting-appointment-date.handler';
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
    selectingSpecialtyHandler: SelectingSpecialtyHandler,
    selectingAppointmentDateHandler: SelectingAppointmentDateHandler,
    selectingAppointmentTimeHandler: SelectingAppointmentTimeHandler,
  ) {
    this.handlersByState = new Map<ConversationState, ConversationStateHandler>();
    this.handlersByState.set(mainMenuHandler.state, mainMenuHandler);
    this.handlersByState.set(waitingDocumentHandler.state, waitingDocumentHandler);
    this.handlersByState.set(waitingBirthDateHandler.state, waitingBirthDateHandler);
    this.handlersByState.set(patientValidatedHandler.state, patientValidatedHandler);
    this.handlersByState.set(selectingSpecialtyHandler.state, selectingSpecialtyHandler);
    this.handlersByState.set(selectingAppointmentDateHandler.state, selectingAppointmentDateHandler);
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
