import { CancelAssignedAppointmentByPatientUseCase } from '../../../appointments/application/use-cases/cancel-assigned-appointment-by-patient.use-case';
import { ListFutureAssignedAppointmentsByPatientUseCase } from '../../../appointments/application/use-cases/list-future-assigned-appointments-by-patient.use-case';
import { ResolveAvailableAppointmentDatesBySpecialtyUseCase } from '../../../appointments/application/use-cases/resolve-available-appointment-dates-by-specialty.use-case';
import { AuditService } from '../../../audit/application/services/audit.service';
import { AssignedAppointmentDetailsMessageFactory } from '../services/assigned-appointment-details-message.factory';
import { AssignedAppointmentListFactory } from '../services/assigned-appointment-list.factory';
import { AppointmentDateListFactory } from '../services/appointment-date-list.factory';
import { ReviewingAssignedAppointmentActionsHandler } from './reviewing-assigned-appointment-actions.handler';

describe('ReviewingAssignedAppointmentActionsHandler', () => {
  function buildSession() {
    return {
      conversationKey: 'whatsapp:123:573001112233',
      channel: 'whatsapp',
      participantPhone: '573001112233',
      phoneNumberId: '123',
      state: 'REVIEWING_ASSIGNED_APPOINTMENT_ACTIONS',
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
              specialtyCups: '890201',
              professionalName: 'MEDICO',
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

  it('returns success message when cancellation succeeds', async () => {
    const handler = new ReviewingAssignedAppointmentActionsHandler(
      {
        execute: jest.fn().mockResolvedValue({ status: 'CANCELLED' }),
      } as unknown as CancelAssignedAppointmentByPatientUseCase,
      {
        execute: jest.fn(),
      } as unknown as ListFutureAssignedAppointmentsByPatientUseCase,
      {
        execute: jest.fn(),
      } as unknown as ResolveAvailableAppointmentDatesBySpecialtyUseCase,
      new AssignedAppointmentListFactory(),
      new AssignedAppointmentDetailsMessageFactory(),
      new AppointmentDateListFactory(),
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
      interactiveReplyId: 'assigned_appointment_action:cancel',
      interactiveReplyTitle: 'Cancelar',
      phoneNumberId: '123',
    });

    expect(result.nextState).toBe('SELECTING_ASSIGNED_APPOINTMENT');
    expect(result.outboundMessages[0]).toMatchObject({
      type: 'text',
      body: 'Su cita se cancelo correctamente',
    });
  });

  it('starts the date selection flow when reprogram action is selected', async () => {
    const handler = new ReviewingAssignedAppointmentActionsHandler(
      {
        execute: jest.fn(),
      } as unknown as CancelAssignedAppointmentByPatientUseCase,
      {
        execute: jest.fn(),
      } as unknown as ListFutureAssignedAppointmentsByPatientUseCase,
      {
        execute: jest.fn().mockResolvedValue({
          hasAvailability: true,
          dates: [{ isoDate: '2026-06-02', displayDate: '02/06/2026' }],
        }),
      } as unknown as ResolveAvailableAppointmentDatesBySpecialtyUseCase,
      new AssignedAppointmentListFactory(),
      new AssignedAppointmentDetailsMessageFactory(),
      new AppointmentDateListFactory(),
      {
        record: jest.fn().mockResolvedValue(undefined),
      } as unknown as AuditService,
    );

    const result = await handler.handle(buildSession(), {
      kind: 'incoming_message_received',
      messageId: 'wamid-2',
      from: '573001112233',
      timestamp: '1711111112',
      messageType: 'interactive',
      interactiveReplyId: 'assigned_appointment_action:reprogram',
      interactiveReplyTitle: 'Reprogramar',
      phoneNumberId: '123',
    });

    expect(result.nextState).toBe('SELECTING_APPOINTMENT_DATE');
    expect(result.nextContext?.appointmentReschedule).toMatchObject({
      originalSlotRef: '101',
      originalSpecialtyCups: '890201',
    });
    expect(result.outboundMessages[0]).toMatchObject({
      type: 'interactive_list',
    });
  });
});
