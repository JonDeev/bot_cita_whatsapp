import { CONVERSATION_STATES } from '../../domain/conversation-state';
import { AssignedAppointmentConsultationDetailsMessageFactory } from './assigned-appointment-consultation-details-message.factory';
import { AssignedAppointmentDetailsMessageFactory } from './assigned-appointment-details-message.factory';
import { AssignedAppointmentListFactory } from './assigned-appointment-list.factory';
import { AppointmentDoctorListFactory } from './appointment-doctor-list.factory';
import { AppointmentDoctorListPresenterService } from './appointment-doctor-list-presenter.service';
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
      new AssignedAppointmentListFactory(),
      new AssignedAppointmentConsultationDetailsMessageFactory(),
      new AssignedAppointmentDetailsMessageFactory(),
      new AppointmentDoctorListFactory(new AppointmentDoctorListPresenterService()),
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
          body: 'Escribe tu numero de documento de identidad.',
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

  it('builds the assigned appointment list when returning to cancel or reschedule flow', () => {
    const service = buildService();

    const result = service.buildForState(
      {
        conversationKey: 'whatsapp:123:573001112233',
        channel: 'whatsapp',
        participantPhone: '573001112233',
        phoneNumberId: '123',
        state: CONVERSATION_STATES.SELECTING_ASSIGNED_APPOINTMENT,
        status: 'BOT_ACTIVE',
        context: {
          assignedAppointmentSelection: {
            patientFullName: 'DANIEL CASTANO',
            currentOffset: 0,
            hasMoreAppointments: false,
            offeredAppointments: [
              {
                slotRef: '101',
                specialtyName: 'MEDICINA GENERAL',
                professionalName: 'MEDICO',
                siteName: 'Sede Central',
                siteAddress: 'Calle 1 # 2-3',
                appointmentDateIso: '2026-05-30',
                appointmentTimeHHmm: '11:40',
                appointmentDisplayTime: '11:40 AM',
              },
            ],
          },
        },
        createdAt: '2026-05-04T10:00:00.000Z',
        updatedAt: '2026-05-04T10:00:00.000Z',
      },
      CONVERSATION_STATES.SELECTING_ASSIGNED_APPOINTMENT,
    );

    expect(result.nextState).toBe(CONVERSATION_STATES.SELECTING_ASSIGNED_APPOINTMENT);
    expect(result.outboundMessages[0]).toMatchObject({
      type: 'interactive_list',
      buttonText: 'Ver citas',
    });
  });

  it('builds assigned appointment consultation details prompt when returning to read-only details', () => {
    const service = buildService();

    const result = service.buildForState(
      {
        conversationKey: 'whatsapp:123:573001112233',
        channel: 'whatsapp',
        participantPhone: '573001112233',
        phoneNumberId: '123',
        state: CONVERSATION_STATES.REVIEWING_ASSIGNED_APPOINTMENT_DETAILS,
        status: 'BOT_ACTIVE',
        context: {
          flowIntent: 'CHECK_APPOINTMENTS',
          assignedAppointmentSelection: {
            patientFullName: 'DANIEL CASTANO',
            currentOffset: 0,
            hasMoreAppointments: false,
            offeredAppointments: [],
            selectedAppointment: {
              slotRef: '101',
              specialtyName: 'MEDICINA GENERAL',
              professionalName: 'MEDICO',
              siteName: 'Sede Central',
              siteAddress: 'Calle 1 # 2-3',
              appointmentDateIso: '2026-05-30',
              appointmentTimeHHmm: '11:40',
              appointmentDisplayTime: '11:40 AM',
            },
          },
        },
        createdAt: '2026-05-04T10:00:00.000Z',
        updatedAt: '2026-05-04T10:00:00.000Z',
      },
      CONVERSATION_STATES.REVIEWING_ASSIGNED_APPOINTMENT_DETAILS,
    );

    expect(result.nextState).toBe(CONVERSATION_STATES.REVIEWING_ASSIGNED_APPOINTMENT_DETAILS);
    expect(result.outboundMessages[0]).toMatchObject({
      type: 'interactive_buttons',
      buttons: [
        { id: 'nav_back', title: 'Volver' },
        { id: 'nav_main_menu', title: 'Menu principal' },
        { id: 'nav_finish', title: 'Finalizar' },
      ],
    });
  });

  it('builds the doctor list when returning to doctor selection', () => {
    const service = buildService();

    const result = service.buildForState(
      {
        conversationKey: 'whatsapp:123:573001112233',
        channel: 'whatsapp',
        participantPhone: '573001112233',
        phoneNumberId: '123',
        state: CONVERSATION_STATES.SELECTING_APPOINTMENT_DOCTOR,
        status: 'BOT_ACTIVE',
        context: {
          appointmentDoctorSelection: {
            offeredDoctors: [{ employeeCode: 'M001', displayName: 'ANA GARCIA' }],
          },
        },
        createdAt: '2026-05-04T10:00:00.000Z',
        updatedAt: '2026-05-04T10:00:00.000Z',
      },
      CONVERSATION_STATES.SELECTING_APPOINTMENT_DOCTOR,
    );

    expect(result).toEqual({
      nextState: CONVERSATION_STATES.SELECTING_APPOINTMENT_DOCTOR,
      outboundMessages: [
        {
          type: 'interactive_list',
          body: 'Selecciona el medico con quien deseas agendar.',
          buttonText: 'Ver medicos',
          sections: [
            {
              title: 'Medicos disponibles',
              rows: [{ id: 'appointment_doctor:M001', title: 'ANA GARCIA' }],
            },
          ],
        },
      ],
    });
  });
});
