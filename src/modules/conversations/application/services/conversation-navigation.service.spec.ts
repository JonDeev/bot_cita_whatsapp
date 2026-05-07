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

  it('builds menu+finish buttons for assigned appointment selection step', () => {
    const service = new ConversationNavigationService();

    const message = service.buildNavigationMessage(
      CONVERSATION_STATES.SELECTING_ASSIGNED_APPOINTMENT,
    );

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
        { id: 'nav_back', title: 'Volver' },
        { id: 'nav_main_menu', title: 'Menu principal' },
        { id: 'nav_finish', title: 'Finalizar' },
      ],
    });
  });

  it('returns specialty step as back target for appointment date selection', () => {
    const service = new ConversationNavigationService();

    expect(
      service.resolveBackNavigation({
        conversationKey: 'whatsapp:123:573001112233',
        channel: 'whatsapp',
        participantPhone: '573001112233',
        phoneNumberId: '123',
        state: CONVERSATION_STATES.SELECTING_APPOINTMENT_DATE,
        status: 'BOT_ACTIVE',
        createdAt: '2026-05-04T10:00:00.000Z',
        updatedAt: '2026-05-04T10:00:00.000Z',
      }).targetState,
    ).toBe(CONVERSATION_STATES.SELECTING_SPECIALTY);
  });

  it('returns appointment date step as back target for appointment time selection', () => {
    const service = new ConversationNavigationService();

    expect(
      service.resolveBackNavigation({
        conversationKey: 'whatsapp:123:573001112233',
        channel: 'whatsapp',
        participantPhone: '573001112233',
        phoneNumberId: '123',
        state: CONVERSATION_STATES.SELECTING_APPOINTMENT_TIME,
        status: 'BOT_ACTIVE',
        createdAt: '2026-05-04T10:00:00.000Z',
        updatedAt: '2026-05-04T10:00:00.000Z',
      }).targetState,
    ).toBe(CONVERSATION_STATES.SELECTING_APPOINTMENT_DATE);
  });

  it('returns assigned appointment selection when navigating back from consultation details', () => {
    const service = new ConversationNavigationService();

    expect(
      service.resolveBackNavigation({
        conversationKey: 'whatsapp:123:573001112233',
        channel: 'whatsapp',
        participantPhone: '573001112233',
        phoneNumberId: '123',
        state: CONVERSATION_STATES.REVIEWING_ASSIGNED_APPOINTMENT_DETAILS,
        status: 'BOT_ACTIVE',
        createdAt: '2026-05-04T10:00:00.000Z',
        updatedAt: '2026-05-04T10:00:00.000Z',
      }).targetState,
    ).toBe(CONVERSATION_STATES.SELECTING_ASSIGNED_APPOINTMENT);
  });

  it('returns doctor step when navigating back from doctor-filtered dates', () => {
    const service = new ConversationNavigationService();

    const result = service.resolveBackNavigation({
      conversationKey: 'whatsapp:123:573001112233',
      channel: 'whatsapp',
      participantPhone: '573001112233',
      phoneNumberId: '123',
      state: CONVERSATION_STATES.SELECTING_APPOINTMENT_DATE,
      status: 'BOT_ACTIVE',
      context: {
        appointmentDateSelection: {
          scope: 'DOCTOR',
          specialtyOfferedDates: [{ isoDate: '2026-05-06', displayDate: '06/05/2026' }],
          offeredDates: [{ isoDate: '2026-05-07', displayDate: '07/05/2026' }],
        },
      },
      createdAt: '2026-05-04T10:00:00.000Z',
      updatedAt: '2026-05-04T10:00:00.000Z',
    });

    expect(result.targetState).toBe(CONVERSATION_STATES.SELECTING_APPOINTMENT_DOCTOR);
  });

  it('returns reviewing-assigned-actions when navigating back from reprogramming date selection', () => {
    const service = new ConversationNavigationService();

    const result = service.resolveBackNavigation({
      conversationKey: 'whatsapp:123:573001112233',
      channel: 'whatsapp',
      participantPhone: '573001112233',
      phoneNumberId: '123',
      state: CONVERSATION_STATES.SELECTING_APPOINTMENT_DATE,
      status: 'BOT_ACTIVE',
      context: {
        appointmentReschedule: {
          originalSlotRef: '101',
          originalSpecialtyName: 'MEDICINA GENERAL',
          originalSpecialtyCups: '890201',
          originalAppointmentDateIso: '2026-05-20',
          originalAppointmentTimeHHmm: '11:40',
        },
        appointmentDateSelection: {
          scope: 'SPECIALTY',
          specialtyOfferedDates: [{ isoDate: '2026-05-30', displayDate: '30/05/2026' }],
          offeredDates: [{ isoDate: '2026-05-30', displayDate: '30/05/2026' }],
        },
      },
      createdAt: '2026-05-04T10:00:00.000Z',
      updatedAt: '2026-05-04T10:00:00.000Z',
    });

    expect(result.targetState).toBe(
      CONVERSATION_STATES.REVIEWING_ASSIGNED_APPOINTMENT_ACTIONS,
    );
    expect(result.nextContext?.appointmentReschedule).toBeUndefined();
  });
});
