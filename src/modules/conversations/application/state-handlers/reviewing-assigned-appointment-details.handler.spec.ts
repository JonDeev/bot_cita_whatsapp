import { AssignedAppointmentConsultationDetailsMessageFactory } from '../services/assigned-appointment-consultation-details-message.factory';
import { AssignedAppointmentListFactory } from '../services/assigned-appointment-list.factory';
import { ReviewingAssignedAppointmentDetailsHandler } from './reviewing-assigned-appointment-details.handler';

describe('ReviewingAssignedAppointmentDetailsHandler', () => {
  function buildSession() {
    return {
      conversationKey: 'whatsapp:123:573001112233',
      channel: 'whatsapp',
      participantPhone: '573001112233',
      phoneNumberId: '123',
      state: 'REVIEWING_ASSIGNED_APPOINTMENT_DETAILS',
      status: 'BOT_ACTIVE',
      context: {
        flowIntent: 'CHECK_APPOINTMENTS',
        patientValidation: {
          failedAttempts: 0,
          patientId: 10,
        },
        assignedAppointmentSelection: {
          patientFullName: 'DANIEL CASTANO',
          currentOffset: 0,
          hasMoreAppointments: false,
          offeredAppointments: [
            {
              slotRef: '101',
              specialtyName: 'MEDICINA GENERAL',
              specialtyCups: '890201',
              professionalName: 'MEDICO',
              siteName: 'Sede Central',
              siteAddress: 'Calle 1 # 2-3',
              appointmentDateIso: '2026-05-30',
              appointmentTimeHHmm: '11:40',
              appointmentDisplayTime: '11:40 AM',
            },
          ],
          selectedAppointment: {
            slotRef: '101',
            specialtyName: 'MEDICINA GENERAL',
            specialtyCups: '890201',
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
    } as const;
  }

  it('rebuilds consultation details when receiving non-navigation input', async () => {
    const handler = new ReviewingAssignedAppointmentDetailsHandler(
      new AssignedAppointmentListFactory(),
      new AssignedAppointmentConsultationDetailsMessageFactory(),
    );

    const result = await handler.handle(buildSession(), {
      kind: 'incoming_message_received',
      messageId: 'wamid-1',
      from: '573001112233',
      timestamp: '1711111111',
      messageType: 'text',
      textBody: 'ok',
      phoneNumberId: '123',
    });

    expect(result.nextState).toBe('REVIEWING_ASSIGNED_APPOINTMENT_DETAILS');
    expect(result.outboundMessages[0]).toMatchObject({
      type: 'interactive_buttons',
      body: expect.stringContaining('su cita agendada es'),
      buttons: [
        { id: 'nav_back', title: 'Volver' },
        { id: 'nav_main_menu', title: 'Menu principal' },
        { id: 'nav_finish', title: 'Finalizar' },
      ],
    });
  });

  it('returns to appointment list when selected appointment is not present', async () => {
    const handler = new ReviewingAssignedAppointmentDetailsHandler(
      new AssignedAppointmentListFactory(),
      new AssignedAppointmentConsultationDetailsMessageFactory(),
    );

    const result = await handler.handle(
      {
        ...buildSession(),
        context: {
          ...buildSession().context,
          assignedAppointmentSelection: {
            ...buildSession().context.assignedAppointmentSelection,
            selectedAppointment: undefined,
          },
        },
      },
      {
        kind: 'incoming_message_received',
        messageId: 'wamid-2',
        from: '573001112233',
        timestamp: '1711111112',
        messageType: 'text',
        textBody: 'ok',
        phoneNumberId: '123',
      },
    );

    expect(result.nextState).toBe('SELECTING_ASSIGNED_APPOINTMENT');
    expect(result.outboundMessages[0]).toMatchObject({
      type: 'interactive_list',
      body: 'Hola DANIEL CASTANO Estas son tus citas agendadas',
    });
  });
});
