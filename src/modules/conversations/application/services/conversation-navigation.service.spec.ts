import { CONVERSATION_STATES } from '../../domain/conversation-state';
import { ConversationNavigationService } from './conversation-navigation.service';

describe('ConversationNavigationService', () => {
  it('does not build navigation buttons for document and birth date steps', () => {
    const service = new ConversationNavigationService();

    const documentStepMessage = service.buildNavigationMessage(CONVERSATION_STATES.WAITING_DOCUMENT);
    const birthDateStepMessage = service.buildNavigationMessage(CONVERSATION_STATES.WAITING_BIRTH_DATE);

    expect(documentStepMessage).toBeNull();
    expect(birthDateStepMessage).toBeNull();
  });

  it('builds menu+finish buttons for specialty selection step', () => {
    const service = new ConversationNavigationService();

    const message = service.buildNavigationMessage(CONVERSATION_STATES.SELECTING_SPECIALTY);

    expect(message).toMatchObject({
      type: 'interactive_buttons',
      buttons: [
        { id: 'nav_main_menu', title: 'Menu principal' },
        { id: 'nav_finish', title: 'Finalizar' },
      ],
    });
  });

  it('builds back+menu+finish buttons for other states', () => {
    const service = new ConversationNavigationService();

    const message = service.buildNavigationMessage(CONVERSATION_STATES.MAIN_MENU);

    expect(message).toMatchObject({
      type: 'interactive_buttons',
      buttons: [
        { id: 'nav_back', title: '↩ Volver' },
        { id: 'nav_main_menu', title: 'Menu principal' },
        { id: 'nav_finish', title: 'Finalizar' },
      ],
    });
  });

  it('returns specialty step as back target for appointment date selection', () => {
    const service = new ConversationNavigationService();

    expect(service.resolveBackTargetState(CONVERSATION_STATES.SELECTING_APPOINTMENT_DATE)).toBe(
      CONVERSATION_STATES.SELECTING_SPECIALTY,
    );
  });

  it('returns appointment date step as back target for appointment time selection', () => {
    const service = new ConversationNavigationService();

    expect(service.resolveBackTargetState(CONVERSATION_STATES.SELECTING_APPOINTMENT_TIME)).toBe(
      CONVERSATION_STATES.SELECTING_APPOINTMENT_DATE,
    );
  });
});
