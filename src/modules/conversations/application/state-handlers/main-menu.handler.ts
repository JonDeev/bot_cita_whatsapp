import { Injectable } from '@nestjs/common';
import type { NormalizedWhatsappEvent } from '../../../whatsapp/domain/events/normalized-whatsapp.event';
import { CONVERSATION_STATES } from '../../domain/conversation-state';
import type { ConversationSession } from '../../domain/entities/conversation-session.entity';
import { MAIN_MENU_OPTION_IDS } from '../services/main-menu-option-id';
import { MainMenuListFactory } from '../services/main-menu-list.factory';
import type {
  ConversationStateHandler,
  ConversationStateHandlerResult,
} from './conversation-state-handler';

@Injectable()
export class MainMenuHandler implements ConversationStateHandler {
  readonly state = CONVERSATION_STATES.MAIN_MENU;

  constructor(private readonly mainMenuListFactory: MainMenuListFactory) {}

  async handle(
    _session: ConversationSession,
    event: NormalizedWhatsappEvent,
  ): Promise<ConversationStateHandlerResult> {
    await Promise.resolve();

    if (event.kind !== 'incoming_message_received') {
      return {
        nextState: CONVERSATION_STATES.MAIN_MENU,
        outboundMessages: [],
      };
    }

    if (
      event.messageType === 'interactive' &&
      event.interactiveReplyId === MAIN_MENU_OPTION_IDS.REQUEST_APPOINTMENT
    ) {
      return this.buildDocumentRequestResponse('REQUEST_APPOINTMENT');
    }

    if (
      event.messageType === 'interactive' &&
      event.interactiveReplyId === MAIN_MENU_OPTION_IDS.CHECK_APPOINTMENTS
    ) {
      return this.buildDocumentRequestResponse('CHECK_APPOINTMENTS');
    }

    if (
      event.messageType === 'interactive' &&
      event.interactiveReplyId === MAIN_MENU_OPTION_IDS.CHECK_DISPENSARY
    ) {
      return this.buildDocumentRequestResponse('CHECK_DISPENSARY');
    }

    if (
      event.messageType === 'interactive' &&
      event.interactiveReplyId === MAIN_MENU_OPTION_IDS.CANCEL_OR_RESCHEDULE
    ) {
      return this.buildDocumentRequestResponse('CANCEL_OR_RESCHEDULE');
    }

    if (
      event.messageType === 'interactive' &&
      event.interactiveReplyId === MAIN_MENU_OPTION_IDS.UPDATE_CONTACT
    ) {
      return this.buildDocumentRequestResponse('UPDATE_CONTACT');
    }

    if (event.messageType === 'interactive' && event.interactiveReplyId) {
      return {
        nextState: CONVERSATION_STATES.MAIN_MENU,
        outboundMessages: [
          {
            type: 'text',
            body: 'Esta opcion estara disponible pronto. Por ahora puedes continuar con Solicitar cita.',
          },
          this.mainMenuListFactory.build(),
        ],
      };
    }

    return {
      nextState: CONVERSATION_STATES.MAIN_MENU,
      outboundMessages: [this.mainMenuListFactory.build()],
    };
  }

  private buildDocumentRequestResponse(
    flowIntent:
      | 'REQUEST_APPOINTMENT'
      | 'CANCEL_OR_RESCHEDULE'
      | 'CHECK_APPOINTMENTS'
      | 'CHECK_DISPENSARY'
      | 'UPDATE_CONTACT',
  ): ConversationStateHandlerResult {
    return {
      nextState: CONVERSATION_STATES.WAITING_DOCUMENT,
      nextContext: {
        flowIntent,
        patientValidation: {
          failedAttempts: 0,
        },
        contactVerification: undefined,
        appointmentNotificationsConsentPhone: undefined,
        assignedAppointmentSelection: undefined,
        appointmentReschedule: undefined,
        specialtySelection: undefined,
        appointmentDoctorSelection: undefined,
        appointmentDateSelection: undefined,
        appointmentTimeSelection: undefined,
      },
      outboundMessages: [
        {
          type: 'text',
          body: 'Escribe tu numero de documento de identidad.',
        },
      ],
    };
  }
}
