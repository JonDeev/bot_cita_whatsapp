import { Injectable } from '@nestjs/common';
import { CONVERSATION_STATES, type ConversationState } from '../../domain/conversation-state';
import type { ConversationSession } from '../../domain/entities/conversation-session.entity';
import type { ConversationSessionContext } from '../../domain/entities/conversation-session-context.entity';
import type {
  ConversationOutboundInteractiveButtonReply,
  ConversationOutboundInteractiveButtonsMessage,
} from '../../domain/value-objects/conversation-outbound-message';

export const NAVIGATION_OPTION_IDS = {
  BACK: 'nav_back',
  MAIN_MENU: 'nav_main_menu',
  FINISH: 'nav_finish',
} as const;

export type NavigationOptionId =
  (typeof NAVIGATION_OPTION_IDS)[keyof typeof NAVIGATION_OPTION_IDS];

type NavigationPreset = 'MENU_AND_FINISH' | 'BACK_MENU_AND_FINISH';

const STATES_WITHOUT_NAVIGATION = new Set<ConversationState>([
  CONVERSATION_STATES.WAITING_DOCUMENT,
  CONVERSATION_STATES.WAITING_BIRTH_DATE,
]);

const STATES_WITHOUT_BACK = new Set<ConversationState>([
  CONVERSATION_STATES.SELECTING_SPECIALTY,
]);

const BACK_TARGET_BY_STATE: Partial<Record<ConversationState, ConversationState>> = {
  [CONVERSATION_STATES.WAITING_BIRTH_DATE]: CONVERSATION_STATES.WAITING_DOCUMENT,
  [CONVERSATION_STATES.SELECTING_SPECIALTY]: CONVERSATION_STATES.WAITING_BIRTH_DATE,
  [CONVERSATION_STATES.SELECTING_APPOINTMENT_DATE]: CONVERSATION_STATES.SELECTING_SPECIALTY,
  [CONVERSATION_STATES.SELECTING_APPOINTMENT_DOCTOR]: CONVERSATION_STATES.SELECTING_APPOINTMENT_DATE,
  [CONVERSATION_STATES.SELECTING_APPOINTMENT_TIME]: CONVERSATION_STATES.SELECTING_APPOINTMENT_DATE,
};

const NAVIGATION_BUTTONS_BODY_PLACEHOLDER = '\u200B';

@Injectable()
export class ConversationNavigationService {
  isNavigationOptionId(value: string | undefined | null): value is NavigationOptionId {
    if (!value) {
      return false;
    }

    return Object.values(NAVIGATION_OPTION_IDS).includes(value as NavigationOptionId);
  }

  buildNavigationMessage(
    state: ConversationState,
  ): ConversationOutboundInteractiveButtonsMessage | null {
    const preset = this.resolvePresetForState(state);
    if (!preset) {
      return null;
    }

    return {
      type: 'interactive_buttons',
      body: NAVIGATION_BUTTONS_BODY_PLACEHOLDER,
      buttons: this.buildButtonsByPreset(preset),
    };
  }

  resolveBackNavigation(session: ConversationSession): {
    targetState: ConversationState;
    nextContext?: ConversationSessionContext;
  } {
    if (
      session.state === CONVERSATION_STATES.SELECTING_APPOINTMENT_DOCTOR &&
      session.context?.appointmentDateSelection
    ) {
      const specialtyOfferedDates =
        session.context.appointmentDateSelection.specialtyOfferedDates;

      return {
        targetState: CONVERSATION_STATES.SELECTING_APPOINTMENT_DATE,
        nextContext: {
          ...session.context,
          appointmentDoctorSelection: session.context.appointmentDoctorSelection
            ? {
              offeredDoctors: session.context.appointmentDoctorSelection.offeredDoctors,
              selectedDoctor: undefined,
            }
            : undefined,
          appointmentDateSelection: {
            ...session.context.appointmentDateSelection,
            scope: 'SPECIALTY',
            offeredDates: specialtyOfferedDates,
            specialtyOfferedDates,
            selectedDateIso: undefined,
          },
          appointmentTimeSelection: undefined,
        },
      };
    }

    if (
      session.state === CONVERSATION_STATES.SELECTING_APPOINTMENT_DATE &&
      session.context?.appointmentDateSelection?.scope === 'DOCTOR'
    ) {
      return {
        targetState: CONVERSATION_STATES.SELECTING_APPOINTMENT_DOCTOR,
        nextContext: {
          ...session.context,
          appointmentDateSelection: {
            ...session.context.appointmentDateSelection,
            selectedDateIso: undefined,
          },
          appointmentTimeSelection: undefined,
        },
      };
    }

    return {
      targetState: BACK_TARGET_BY_STATE[session.state] ?? CONVERSATION_STATES.MAIN_MENU,
    };
  }

  private resolvePresetForState(state: ConversationState): NavigationPreset | null {
    if (STATES_WITHOUT_NAVIGATION.has(state)) {
      return null;
    }

    if (STATES_WITHOUT_BACK.has(state)) {
      return 'MENU_AND_FINISH';
    }

    return 'BACK_MENU_AND_FINISH';
  }

  private buildButtonsByPreset(
    preset: NavigationPreset,
  ): ConversationOutboundInteractiveButtonReply[] {
    if (preset === 'MENU_AND_FINISH') {
      return [
        { id: NAVIGATION_OPTION_IDS.MAIN_MENU, title: 'Menu principal' },
        { id: NAVIGATION_OPTION_IDS.FINISH, title: 'Finalizar' },
      ];
    }

    return [
      { id: NAVIGATION_OPTION_IDS.BACK, title: 'Volver' },
      { id: NAVIGATION_OPTION_IDS.MAIN_MENU, title: 'Menu principal' },
      { id: NAVIGATION_OPTION_IDS.FINISH, title: 'Finalizar' },
    ];
  }
}
