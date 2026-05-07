import { ListFutureAssignedAppointmentsByPatientUseCase } from '../../../appointments/application/use-cases/list-future-assigned-appointments-by-patient.use-case';
import { AuditService } from '../../../audit/application/services/audit.service';
import { AssignedAppointmentConsultationDetailsMessageFactory } from '../services/assigned-appointment-consultation-details-message.factory';
import { AssignedAppointmentDetailsMessageFactory } from '../services/assigned-appointment-details-message.factory';
import { AssignedAppointmentListFactory } from '../services/assigned-appointment-list.factory';
import { SelectingAssignedAppointmentHandler } from './selecting-assigned-appointment.handler';

describe('SelectingAssignedAppointmentHandler', () => {
  function buildSession() {
    return {
      conversationKey: 'whatsapp:123:573001112233',
      channel: 'whatsapp',
      participantPhone: '573001112233',
      phoneNumberId: '123',
      state: 'SELECTING_ASSIGNED_APPOINTMENT',
      status: 'BOT_ACTIVE',
      context: {
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
    } as const;
  }

  it('moves to reviewing actions when patient selects a listed appointment', async () => {
    const handler = new SelectingAssignedAppointmentHandler(
      {
        execute: jest.fn(),
      } as unknown as ListFutureAssignedAppointmentsByPatientUseCase,
      new AssignedAppointmentListFactory(),
      new AssignedAppointmentDetailsMessageFactory(),
      new AssignedAppointmentConsultationDetailsMessageFactory(),
      {
        record: jest.fn().mockResolvedValue(undefined),
      } as unknown as AuditService,
    );

    const result = await handler.handle(buildSession(), {
      kind: 'incoming_message_received',
      messageId: 'wamid-1',
      from: '573001112233',
      timestamp: '1711111111',
      messageType: 'interactive',
      interactiveReplyId: 'assigned_appointment:101',
      interactiveReplyTitle: 'MEDICINA GENERAL',
      phoneNumberId: '123',
    });

    expect(result.nextState).toBe('REVIEWING_ASSIGNED_APPOINTMENT_ACTIONS');
    expect(result.outboundMessages[0]).toMatchObject({
      type: 'interactive_buttons',
    });
  });

  it('loads next page when patient selects show more', async () => {
    const handler = new SelectingAssignedAppointmentHandler(
      {
        execute: jest.fn().mockResolvedValue({
          status: 'FOUND',
          patientFullName: 'DANIEL CASTANO',
          appointments: [
            {
              slotRef: '202',
              specialtyName: 'ODONTOLOGIA',
              professionalName: 'MEDICO 2',
              siteName: 'Sede Norte',
              siteAddress: 'Calle 9 # 10-11',
              appointmentDateIso: '2026-06-01',
              appointmentTimeHHmm: '09:00',
              appointmentDisplayTime: '09:00 AM',
            },
          ],
          hasMore: false,
          currentOffset: 9,
        }),
      } as unknown as ListFutureAssignedAppointmentsByPatientUseCase,
      new AssignedAppointmentListFactory(),
      new AssignedAppointmentDetailsMessageFactory(),
      new AssignedAppointmentConsultationDetailsMessageFactory(),
      {
        record: jest.fn().mockResolvedValue(undefined),
      } as unknown as AuditService,
    );

    const result = await handler.handle(
      {
        ...buildSession(),
        context: {
          ...buildSession().context,
          assignedAppointmentSelection: {
            ...buildSession().context.assignedAppointmentSelection,
            hasMoreAppointments: true,
            nextOffset: 9,
          },
        },
      },
      {
        kind: 'incoming_message_received',
        messageId: 'wamid-2',
        from: '573001112233',
        timestamp: '1711111112',
        messageType: 'interactive',
        interactiveReplyId: 'assigned_appointment:show_more',
        interactiveReplyTitle: 'Ver mas citas',
        phoneNumberId: '123',
      },
    );

    expect(result.nextState).toBe('SELECTING_ASSIGNED_APPOINTMENT');
    expect(result.outboundMessages[0]).toMatchObject({
      type: 'interactive_list',
      buttonText: 'Ver citas',
    });
  });

  it('moves to consultation details when flow intent is check appointments', async () => {
    const handler = new SelectingAssignedAppointmentHandler(
      {
        execute: jest.fn(),
      } as unknown as ListFutureAssignedAppointmentsByPatientUseCase,
      new AssignedAppointmentListFactory(),
      new AssignedAppointmentDetailsMessageFactory(),
      new AssignedAppointmentConsultationDetailsMessageFactory(),
      {
        record: jest.fn().mockResolvedValue(undefined),
      } as unknown as AuditService,
    );

    const result = await handler.handle(
      {
        ...buildSession(),
        context: {
          ...buildSession().context,
          flowIntent: 'CHECK_APPOINTMENTS',
        },
      },
      {
        kind: 'incoming_message_received',
        messageId: 'wamid-3',
        from: '573001112233',
        timestamp: '1711111113',
        messageType: 'interactive',
        interactiveReplyId: 'assigned_appointment:101',
        interactiveReplyTitle: 'MEDICINA GENERAL',
        phoneNumberId: '123',
      },
    );

    expect(result.nextState).toBe('REVIEWING_ASSIGNED_APPOINTMENT_DETAILS');
    expect(result.outboundMessages[0]).toMatchObject({
      type: 'interactive_buttons',
      buttons: [
        { id: 'nav_back', title: 'Volver' },
        { id: 'nav_main_menu', title: 'Menu principal' },
        { id: 'nav_finish', title: 'Finalizar' },
      ],
    });
  });
});
