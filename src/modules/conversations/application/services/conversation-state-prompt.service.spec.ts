import { CONVERSATION_STATES } from '../../domain/conversation-state';
import { ConversationStatePromptService } from './conversation-state-prompt.service';
import { AppointmentDateListFactory } from './appointment-date-list.factory';
import { AppointmentTimeListFactory } from './appointment-time-list.factory';
import { MainMenuListFactory } from './main-menu-list.factory';
import { SpecialtyListFactory } from './specialty-list.factory';

describe('ConversationStatePromptService', () => {
  function buildService(): ConversationStatePromptService {
    return new ConversationStatePromptService(
      new MainMenuListFactory(),
      new SpecialtyListFactory(),
      new AppointmentDateListFactory(),
      new AppointmentTimeListFactory(),
    );
  }

  it('builds the specialty list when returning to specialty selection', () => {
    const service = buildService();

    const result = service.buildForState(
      {
        conversationKey: 'whatsapp:123:573001112233',
        channel: 'whatsapp',
        participantPhone: '573001112233',
        phoneNumberId: '123',
        state: CONVERSATION_STATES.SELECTING_SPECIALTY,
        status: 'BOT_ACTIVE',
        context: {
          specialtySelection: {
            offeredSpecialties: [{ code: '890201', name: 'MEDICINA GENERAL', cups: '890201' }],
          },
        },
        createdAt: '2026-05-04T10:00:00.000Z',
        updatedAt: '2026-05-04T10:00:00.000Z',
      },
      CONVERSATION_STATES.SELECTING_SPECIALTY,
    );

    expect(result).toEqual({
      nextState: CONVERSATION_STATES.SELECTING_SPECIALTY,
      outboundMessages: [
        {
          type: 'interactive_list',
          body: 'Seleccione la especialidad que desea agendar.',
          buttonText: 'Ver especialidades',
          sections: [
            {
              title: 'Especialidades activas',
              rows: [{ id: 'specialty:890201', title: 'MEDICINA GENERAL' }],
            },
          ],
        },
      ],
    });
  });

  it('falls back to the document prompt when birth date step has no document', () => {
    const service = buildService();

    const result = service.buildForState(
      {
        conversationKey: 'whatsapp:123:573001112233',
        channel: 'whatsapp',
        participantPhone: '573001112233',
        phoneNumberId: '123',
        state: CONVERSATION_STATES.WAITING_BIRTH_DATE,
        status: 'BOT_ACTIVE',
        createdAt: '2026-05-04T10:00:00.000Z',
        updatedAt: '2026-05-04T10:00:00.000Z',
      },
      CONVERSATION_STATES.WAITING_BIRTH_DATE,
    );

    expect(result).toEqual({
      nextState: CONVERSATION_STATES.WAITING_DOCUMENT,
      outboundMessages: [
        {
          type: 'text',
          body: 'Para continuar, escribe tu numero de documento de identidad.',
        },
      ],
    });
  });

  it('builds the appointment time list when returning to time selection', () => {
    const service = buildService();

    const result = service.buildForState(
      {
        conversationKey: 'whatsapp:123:573001112233',
        channel: 'whatsapp',
        participantPhone: '573001112233',
        phoneNumberId: '123',
        state: CONVERSATION_STATES.SELECTING_APPOINTMENT_TIME,
        status: 'BOT_ACTIVE',
        context: {
          appointmentTimeSelection: {
            offeredTimes: [{ slotRef: '101', timeHHmm: '08:30', displayTime: '08:30 AM' }],
            hasMoreTimes: true,
            nextCursorTimeHHmm: '08:30',
          },
        },
        createdAt: '2026-05-04T10:00:00.000Z',
        updatedAt: '2026-05-04T10:00:00.000Z',
      },
      CONVERSATION_STATES.SELECTING_APPOINTMENT_TIME,
    );

    expect(result).toEqual({
      nextState: CONVERSATION_STATES.SELECTING_APPOINTMENT_TIME,
      outboundMessages: [
        {
          type: 'interactive_list',
          body: 'Selecciona la hora de la cita',
          buttonText: 'Ver horas',
          sections: [
            {
              title: 'Horas disponibles',
              rows: [
                { id: 'appointment_time:101', title: '08:30 AM' },
                { id: 'appointment_time:show_more', title: 'Mostrar mas' },
              ],
            },
          ],
        },
      ],
    });
  });
});
