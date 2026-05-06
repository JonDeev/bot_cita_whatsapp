import { Injectable } from '@nestjs/common';
import { CONVERSATION_STATES, type ConversationState } from '../../domain/conversation-state';
import type { ConversationSessionContext } from '../../domain/entities/conversation-session-context.entity';
import type { ConversationSession } from '../../domain/entities/conversation-session.entity';
import type { ConversationOutboundMessage } from '../../domain/value-objects/conversation-outbound-message';
import { AppointmentDateListFactory } from './appointment-date-list.factory';
import { AppointmentTimeListFactory } from './appointment-time-list.factory';
import { MainMenuListFactory } from './main-menu-list.factory';
import { SpecialtyListFactory } from './specialty-list.factory';

export interface ConversationStatePromptResult {
  nextState: ConversationState;
  nextContext?: ConversationSessionContext;
  outboundMessages: ConversationOutboundMessage[];
}

@Injectable()
export class ConversationStatePromptService {
  constructor(
    private readonly mainMenuListFactory: MainMenuListFactory,
    private readonly specialtyListFactory: SpecialtyListFactory,
    private readonly appointmentDateListFactory: AppointmentDateListFactory,
    private readonly appointmentTimeListFactory: AppointmentTimeListFactory,
  ) {}

  buildForState(
    session: ConversationSession,
    state: ConversationState,
  ): ConversationStatePromptResult {
    switch (state) {
      case CONVERSATION_STATES.MAIN_MENU:
        return {
          nextState: CONVERSATION_STATES.MAIN_MENU,
          outboundMessages: [this.mainMenuListFactory.build()],
        };

      case CONVERSATION_STATES.WAITING_DOCUMENT:
        return {
          nextState: CONVERSATION_STATES.WAITING_DOCUMENT,
          outboundMessages: [
            {
              type: 'text',
              body: 'Para continuar, escribe tu numero de documento de identidad.',
            },
          ],
        };

      case CONVERSATION_STATES.WAITING_BIRTH_DATE:
        if (!session.context?.patientValidation?.documentNumber) {
          return this.buildForState(session, CONVERSATION_STATES.WAITING_DOCUMENT);
        }

        return {
          nextState: CONVERSATION_STATES.WAITING_BIRTH_DATE,
          outboundMessages: [
            {
              type: 'text',
              body: 'Ahora escribe tu fecha de nacimiento en formato DD-MM-YYYY.',
            },
          ],
        };

      case CONVERSATION_STATES.SELECTING_SPECIALTY: {
        const offeredSpecialties = session.context?.specialtySelection?.offeredSpecialties ?? [];
        if (offeredSpecialties.length === 0) {
          return this.buildMainMenuFallback(
            'No encontramos especialidades activas para continuar. Volvamos al menu principal.',
          );
        }

        return {
          nextState: CONVERSATION_STATES.SELECTING_SPECIALTY,
          outboundMessages: [this.specialtyListFactory.build(offeredSpecialties)],
        };
      }

      case CONVERSATION_STATES.SELECTING_APPOINTMENT_DATE: {
        const offeredDates = session.context?.appointmentDateSelection?.offeredDates ?? [];
        if (offeredDates.length === 0) {
          return this.buildMainMenuFallback(
            'No encontramos fechas disponibles para continuar. Volvamos al menu principal.',
          );
        }

        return {
          nextState: CONVERSATION_STATES.SELECTING_APPOINTMENT_DATE,
          outboundMessages: [this.appointmentDateListFactory.build(offeredDates)],
        };
      }

      case CONVERSATION_STATES.SELECTING_APPOINTMENT_TIME: {
        const offeredTimes = session.context?.appointmentTimeSelection?.offeredTimes ?? [];
        const hasMoreTimes = session.context?.appointmentTimeSelection?.hasMoreTimes ?? false;
        if (offeredTimes.length === 0) {
          return this.buildMainMenuFallback(
            'No encontramos horas disponibles para continuar. Volvamos al menu principal.',
          );
        }

        return {
          nextState: CONVERSATION_STATES.SELECTING_APPOINTMENT_TIME,
          outboundMessages: [this.appointmentTimeListFactory.build(offeredTimes, hasMoreTimes)],
        };
      }

      default:
        return this.buildForState(session, CONVERSATION_STATES.MAIN_MENU);
    }
  }

  private buildMainMenuFallback(message: string): ConversationStatePromptResult {
    return {
      nextState: CONVERSATION_STATES.MAIN_MENU,
      outboundMessages: [
        {
          type: 'text',
          body: message,
        },
        this.mainMenuListFactory.build(),
      ],
    };
  }
}
