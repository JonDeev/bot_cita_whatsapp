import { CONVERSATION_STATES } from '../../domain/conversation-state';
import { InteractivePromptWindowService } from './interactive-prompt-window.service';

describe('InteractivePromptWindowService', () => {
  it('registers and validates an interactive reply with matching context message id', () => {
    const service = new InteractivePromptWindowService();

    const context = service.registerPrompt({
      state: CONVERSATION_STATES.MAIN_MENU,
      outboundMessageId: 'wamid-main-menu-1',
      outboundMessage: {
        type: 'interactive_list',
        body: 'Menu',
        buttonText: 'Ver opciones',
        sections: [
          {
            title: 'Principal',
            rows: [{ id: 'main_menu_request_appointment', title: 'Cita' }],
          },
        ],
      },
      source: 'ORIGINAL',
      issuedAt: '2026-05-22T12:00:00.000Z',
    });

    const result = service.validateReply({
      state: CONVERSATION_STATES.MAIN_MENU,
      interactiveReplyId: 'main_menu_request_appointment',
      contextMessageId: 'wamid-main-menu-1',
      context,
    });

    expect(result.isValid).toBe(true);
    expect(result.reason).toBeNull();
  });

  it('rejects an interactive reply when context message id mismatches', () => {
    const service = new InteractivePromptWindowService();
    const context = service.registerPrompt({
      state: CONVERSATION_STATES.SELECTING_SPECIALTY,
      outboundMessageId: 'wamid-specialty-1',
      outboundMessage: {
        type: 'interactive_list',
        body: 'Especialidades',
        buttonText: 'Ver',
        sections: [
          {
            title: 'Activas',
            rows: [{ id: 'specialty:890201', title: 'Medicina General' }],
          },
        ],
      },
      source: 'ORIGINAL',
      issuedAt: '2026-05-22T12:00:00.000Z',
    });

    const result = service.validateReply({
      state: CONVERSATION_STATES.SELECTING_SPECIALTY,
      interactiveReplyId: 'specialty:890201',
      contextMessageId: 'wamid-other',
      context,
    });

    expect(result.isValid).toBe(false);
    expect(result.reason).toBe('CONTEXT_MESSAGE_ID_MISMATCH');
  });

  it('accepts reply without context message id when there is a single compatible prompt', () => {
    const service = new InteractivePromptWindowService();
    const context = service.registerPrompt({
      state: CONVERSATION_STATES.CONFIRMING_PATIENT_CONTACT,
      outboundMessageId: 'wamid-contact-1',
      outboundMessage: {
        type: 'interactive_buttons',
        body: 'Confirmar contacto',
        buttons: [{ id: 'contact_confirm_yes', title: 'Si' }],
      },
      source: 'ORIGINAL',
      issuedAt: '2026-05-22T12:00:00.000Z',
    });

    const result = service.validateReply({
      state: CONVERSATION_STATES.CONFIRMING_PATIENT_CONTACT,
      interactiveReplyId: 'contact_confirm_yes',
      context,
    });

    expect(result.isValid).toBe(true);
    expect(result.reason).toBeNull();
  });

  it('accepts reminder compatibility pair without context message id', () => {
    const service = new InteractivePromptWindowService();
    const originalContext = service.registerPrompt({
      state: CONVERSATION_STATES.SELECTING_SPECIALTY,
      outboundMessageId: 'wamid-specialty-1',
      outboundMessage: {
        type: 'interactive_list',
        body: 'Especialidades',
        buttonText: 'Ver',
        sections: [
          {
            title: 'Activas',
            rows: [{ id: 'specialty:890201', title: 'Medicina General' }],
          },
        ],
      },
      source: 'ORIGINAL',
      issuedAt: '2026-05-22T12:00:00.000Z',
    });
    const reminderContext = service.registerPrompt({
      state: CONVERSATION_STATES.SELECTING_SPECIALTY,
      outboundMessageId: 'wamid-specialty-2',
      outboundMessage: {
        type: 'interactive_list',
        body: 'Especialidades',
        buttonText: 'Ver',
        sections: [
          {
            title: 'Activas',
            rows: [{ id: 'specialty:890201', title: 'Medicina General' }],
          },
        ],
      },
      context: originalContext,
      source: 'IDLE_REMINDER_REISSUE',
      issuedAt: '2026-05-22T12:15:00.000Z',
    });

    const result = service.validateReply({
      state: CONVERSATION_STATES.SELECTING_SPECIALTY,
      interactiveReplyId: 'specialty:890201',
      context: reminderContext,
    });

    expect(result.isValid).toBe(true);
    expect(result.reason).toBeNull();
  });
});
