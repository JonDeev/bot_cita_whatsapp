import { AssignAppointmentSlotAfterTimeSelectionUseCase } from '../../../appointments/application/use-cases/assign-appointment-slot-after-time-selection.use-case';
import { ResolveAvailableAppointmentTimesBySpecialtyAndDateUseCase } from '../../../appointments/application/use-cases/resolve-available-appointment-times-by-specialty-and-date.use-case';
import { AuditService } from '../../../audit/application/services/audit.service';
import { AppointmentAssignmentConfirmationMessageFactory } from '../services/appointment-assignment-confirmation-message.factory';
import { AppointmentAvailabilityMessageFactory } from '../services/appointment-availability-message.factory';
import { AppointmentDateListFactory } from '../services/appointment-date-list.factory';
import { AppointmentReschedulingTimeSelectionService } from '../services/appointment-rescheduling-time-selection.service';
import { AppointmentTimeListFactory } from '../services/appointment-time-list.factory';
import { SelectingAppointmentTimeHandler } from './selecting-appointment-time.handler';

describe('SelectingAppointmentTimeHandler', () => {
  function buildHandler(
    resolveTimes: ResolveAvailableAppointmentTimesBySpecialtyAndDateUseCase,
    assignAppointment: AssignAppointmentSlotAfterTimeSelectionUseCase,
    reschedulingTimeSelectionService?: AppointmentReschedulingTimeSelectionService,
  ): SelectingAppointmentTimeHandler {
    return new SelectingAppointmentTimeHandler(
      new AppointmentTimeListFactory(),
      new AppointmentDateListFactory(),
      new AppointmentAssignmentConfirmationMessageFactory(),
      new AppointmentAvailabilityMessageFactory(),
      (reschedulingTimeSelectionService ??
        ({
          handleAfterTimeSelection: jest.fn(),
        } as unknown as AppointmentReschedulingTimeSelectionService)),
      resolveTimes,
      assignAppointment,
      {
        record: jest.fn().mockResolvedValue(undefined),
      } as unknown as AuditService,
    );
  }

  it('assigns appointment immediately after a valid time selection', async () => {
    const handler = buildHandler(
      {
        execute: jest.fn(),
      } as unknown as ResolveAvailableAppointmentTimesBySpecialtyAndDateUseCase,
      {
        execute: jest.fn().mockResolvedValue({
          status: 'ASSIGNED',
          appointment: {
            slotRef: '101',
            specialtyName: 'MEDICINA GENERAL',
            patientFullName: 'DANIEL ANDRES CASTANO NAVARRO',
            appointmentDateIso: '2026-04-30',
            appointmentTimeHHmm: '11:40',
            appointmentDisplayTime: '11:40 AM',
            professionalName: 'ALICAN MARIA ZAMBRANO PIZARRO',
            siteName: 'Santa Marta',
            siteAddress: 'Carrera 19',
            usedFallbackSlot: false,
          },
        }),
      } as unknown as AssignAppointmentSlotAfterTimeSelectionUseCase,
    );

    const result = await handler.handle(
      {
        conversationKey: 'whatsapp:123:573001112233',
        channel: 'whatsapp',
        participantPhone: '573001112233',
        phoneNumberId: '123',
        state: 'SELECTING_APPOINTMENT_TIME',
        status: 'BOT_ACTIVE',
        context: {
          patientValidation: {
            failedAttempts: 0,
            patientId: 98,
          },
          specialtySelection: {
            offeredSpecialties: [{ code: '890201', name: 'MEDICINA GENERAL', cups: '890201' }],
            selectedSpecialty: {
              code: '890201',
              name: 'MEDICINA GENERAL',
              cups: '890201',
            },
          },
          appointmentDateSelection: {
            scope: 'SPECIALTY',
            specialtyOfferedDates: [{ isoDate: '2026-04-30', displayDate: '30/04/2026' }],
            offeredDates: [{ isoDate: '2026-04-30', displayDate: '30/04/2026' }],
            selectedDateIso: '2026-04-30',
          },
          appointmentTimeSelection: {
            offeredTimes: [{ slotRef: '101', timeHHmm: '11:40', displayTime: '11:40 AM' }],
            hasMoreTimes: false,
          },
        },
        createdAt: '2026-05-04T10:00:00.000Z',
        updatedAt: '2026-05-04T10:00:00.000Z',
      },
      {
        kind: 'incoming_message_received',
        messageId: 'wamid-9',
        from: '573001112233',
        timestamp: '1711111119',
        messageType: 'interactive',
        interactiveReplyId: 'appointment_time:101',
        interactiveReplyTitle: '11:40 AM',
        phoneNumberId: '123',
      },
    );

    expect(result.nextState).toBe('MAIN_MENU');
    expect(result.nextContext?.appointmentTimeSelection).toBeUndefined();
    expect(result.outboundMessages[0]).toMatchObject({
      type: 'interactive_buttons',
      buttons: [
        { id: 'nav_main_menu', title: 'Menu principal' },
        { id: 'nav_finish', title: 'Finalizar' },
      ],
    });
  });

  it('keeps show more on next page when additional hours still exist', async () => {
    const handler = buildHandler(
      {
        execute: jest.fn().mockResolvedValue({
          hasAvailability: true as const,
          times: [
            { slotRef: '201', timeHHmm: '09:00', displayTime: '09:00 AM' },
            { slotRef: '202', timeHHmm: '10:00', displayTime: '10:00 AM' },
          ],
          hasMore: true,
          nextCursorTimeHHmm: '10:00',
        }),
      } as unknown as ResolveAvailableAppointmentTimesBySpecialtyAndDateUseCase,
      {
        execute: jest.fn(),
      } as unknown as AssignAppointmentSlotAfterTimeSelectionUseCase,
    );

    const result = await handler.handle(
      {
        conversationKey: 'whatsapp:123:573001112233',
        channel: 'whatsapp',
        participantPhone: '573001112233',
        phoneNumberId: '123',
        state: 'SELECTING_APPOINTMENT_TIME',
        status: 'BOT_ACTIVE',
        context: {
          specialtySelection: {
            offeredSpecialties: [{ code: '890201', name: 'MEDICINA GENERAL', cups: '890201' }],
            selectedSpecialty: {
              code: '890201',
              name: 'MEDICINA GENERAL',
              cups: '890201',
            },
          },
          appointmentDateSelection: {
            scope: 'SPECIALTY',
            specialtyOfferedDates: [{ isoDate: '2026-05-06', displayDate: '06/05/2026' }],
            offeredDates: [{ isoDate: '2026-05-06', displayDate: '06/05/2026' }],
            selectedDateIso: '2026-05-06',
          },
          appointmentTimeSelection: {
            offeredTimes: [{ slotRef: '101', timeHHmm: '08:30', displayTime: '08:30 AM' }],
            hasMoreTimes: true,
            nextCursorTimeHHmm: '08:30',
          },
        },
        createdAt: '2026-05-04T10:00:00.000Z',
        updatedAt: '2026-05-04T10:00:00.000Z',
      },
      {
        kind: 'incoming_message_received',
        messageId: 'wamid-10',
        from: '573001112233',
        timestamp: '1711111120',
        messageType: 'interactive',
        interactiveReplyId: 'appointment_time:show_more',
        interactiveReplyTitle: 'Mostrar mas',
        phoneNumberId: '123',
      },
    );

    expect(result.nextState).toBe('SELECTING_APPOINTMENT_TIME');
    expect(result.nextContext?.appointmentTimeSelection).toEqual({
      offeredTimes: [
        { slotRef: '201', timeHHmm: '09:00', displayTime: '09:00 AM' },
        { slotRef: '202', timeHHmm: '10:00', displayTime: '10:00 AM' },
      ],
      hasMoreTimes: true,
      nextCursorTimeHHmm: '10:00',
    });
  });

  it('rebuilds hours for the same doctor and date when selected slot is no longer available', async () => {
    const resolveTimes = {
      execute: jest.fn().mockResolvedValue({
        hasAvailability: true,
        times: [{ slotRef: '301', timeHHmm: '12:00', displayTime: '12:00 PM' }],
        hasMore: false,
        nextCursorTimeHHmm: undefined,
      }),
    };
    const handler = buildHandler(
      resolveTimes as unknown as ResolveAvailableAppointmentTimesBySpecialtyAndDateUseCase,
      {
        execute: jest.fn().mockResolvedValue({
          status: 'TIME_NO_LONGER_AVAILABLE',
        }),
      } as unknown as AssignAppointmentSlotAfterTimeSelectionUseCase,
    );

    const result = await handler.handle(
      {
        conversationKey: 'whatsapp:123:573001112233',
        channel: 'whatsapp',
        participantPhone: '573001112233',
        phoneNumberId: '123',
        state: 'SELECTING_APPOINTMENT_TIME',
        status: 'BOT_ACTIVE',
        context: {
          patientValidation: {
            failedAttempts: 0,
            patientId: 98,
          },
          specialtySelection: {
            offeredSpecialties: [{ code: '890201', name: 'MEDICINA GENERAL', cups: '890201' }],
            selectedSpecialty: {
              code: '890201',
              name: 'MEDICINA GENERAL',
              cups: '890201',
            },
          },
          appointmentDoctorSelection: {
            offeredDoctors: [{ employeeCode: 'M001', displayName: 'ANA GARCIA' }],
            selectedDoctor: { employeeCode: 'M001', displayName: 'ANA GARCIA' },
          },
          appointmentDateSelection: {
            scope: 'DOCTOR',
            specialtyOfferedDates: [{ isoDate: '2026-05-06', displayDate: '06/05/2026' }],
            offeredDates: [{ isoDate: '2026-05-06', displayDate: '06/05/2026' }],
            selectedDateIso: '2026-05-06',
          },
          appointmentTimeSelection: {
            offeredTimes: [{ slotRef: '101', timeHHmm: '08:30', displayTime: '08:30 AM' }],
            hasMoreTimes: false,
          },
        },
        createdAt: '2026-05-04T10:00:00.000Z',
        updatedAt: '2026-05-04T10:00:00.000Z',
      },
      {
        kind: 'incoming_message_received',
        messageId: 'wamid-15',
        from: '573001112233',
        timestamp: '1711111125',
        messageType: 'interactive',
        interactiveReplyId: 'appointment_time:101',
        interactiveReplyTitle: '08:30 AM',
        phoneNumberId: '123',
      },
    );

    expect(resolveTimes.execute).toHaveBeenLastCalledWith({
      specialtyCups: '890201',
      appointmentDateIso: '2026-05-06',
      doctorEmployeeCode: 'M001',
    });
    expect(result.nextState).toBe('SELECTING_APPOINTMENT_TIME');
    expect(result.outboundMessages[0]).toMatchObject({
      type: 'text',
      body: expect.stringContaining('Ese cupo ya fue ocupado por otro paciente.'),
    });
  });

  it('sends reschedule confirmation when time is selected in rescheduling mode', async () => {
    const handler = buildHandler(
      {
        execute: jest.fn(),
      } as unknown as ResolveAvailableAppointmentTimesBySpecialtyAndDateUseCase,
      {
        execute: jest.fn(),
      } as unknown as AssignAppointmentSlotAfterTimeSelectionUseCase,
      {
        handleAfterTimeSelection: jest.fn().mockResolvedValue({
          status: 'COMPLETED',
          result: {
            nextState: 'MAIN_MENU',
            nextContext: {
              appointmentReschedule: undefined,
            },
            outboundMessages: [
              {
                type: 'interactive_buttons',
                body: 'reprogramada',
                buttons: [],
              },
            ],
          },
        }),
      } as unknown as AppointmentReschedulingTimeSelectionService,
    );

    const result = await handler.handle(
      {
        conversationKey: 'whatsapp:123:573001112233',
        channel: 'whatsapp',
        participantPhone: '573001112233',
        phoneNumberId: '123',
        state: 'SELECTING_APPOINTMENT_TIME',
        status: 'BOT_ACTIVE',
        context: {
          patientValidation: {
            failedAttempts: 0,
            patientId: 98,
          },
          assignedAppointmentSelection: {
            patientFullName: 'DANIEL CASTANO',
            currentOffset: 0,
            hasMoreAppointments: false,
            offeredAppointments: [],
            selectedAppointment: {
              slotRef: '101',
              specialtyName: 'MEDICINA GENERAL',
              specialtyCups: '890201',
              professionalName: 'MEDICO',
              siteName: 'Sede Central',
              siteAddress: 'Calle 1 # 2-3',
              appointmentDateIso: '2026-05-20',
              appointmentTimeHHmm: '11:40',
              appointmentDisplayTime: '11:40 AM',
            },
          },
          appointmentReschedule: {
            originalSlotRef: '101',
            originalSpecialtyName: 'MEDICINA GENERAL',
            originalSpecialtyCups: '890201',
            originalAppointmentDateIso: '2026-05-20',
            originalAppointmentTimeHHmm: '11:40',
          },
          specialtySelection: {
            offeredSpecialties: [{ code: '890201', name: 'MEDICINA GENERAL', cups: '890201' }],
            selectedSpecialty: {
              code: '890201',
              name: 'MEDICINA GENERAL',
              cups: '890201',
            },
          },
          appointmentDateSelection: {
            scope: 'SPECIALTY',
            specialtyOfferedDates: [{ isoDate: '2026-05-30', displayDate: '30/05/2026' }],
            offeredDates: [{ isoDate: '2026-05-30', displayDate: '30/05/2026' }],
            selectedDateIso: '2026-05-30',
          },
          appointmentTimeSelection: {
            offeredTimes: [{ slotRef: '202', timeHHmm: '11:40', displayTime: '11:40 AM' }],
            hasMoreTimes: false,
          },
        },
        createdAt: '2026-05-04T10:00:00.000Z',
        updatedAt: '2026-05-04T10:00:00.000Z',
      },
      {
        kind: 'incoming_message_received',
        messageId: 'wamid-16',
        from: '573001112233',
        timestamp: '1711111126',
        messageType: 'interactive',
        interactiveReplyId: 'appointment_time:202',
        interactiveReplyTitle: '11:40 AM',
        phoneNumberId: '123',
      },
    );

    expect(result.nextState).toBe('MAIN_MENU');
    expect(result.nextContext?.appointmentReschedule).toBeUndefined();
    expect(result.outboundMessages[0]).toMatchObject({
      type: 'interactive_buttons',
    });
  });
});
