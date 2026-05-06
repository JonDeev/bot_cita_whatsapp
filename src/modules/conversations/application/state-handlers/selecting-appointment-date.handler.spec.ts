import { ResolveAvailableAppointmentDoctorsBySpecialtyUseCase } from '../../../appointments/application/use-cases/resolve-available-appointment-doctors-by-specialty.use-case';
import { ResolveAvailableAppointmentTimesBySpecialtyAndDateUseCase } from '../../../appointments/application/use-cases/resolve-available-appointment-times-by-specialty-and-date.use-case';
import { AuditService } from '../../../audit/application/services/audit.service';
import { AppointmentDoctorListFactory } from '../services/appointment-doctor-list.factory';
import { AppointmentDoctorListPresenterService } from '../services/appointment-doctor-list-presenter.service';
import { AppointmentAvailabilityMessageFactory } from '../services/appointment-availability-message.factory';
import { AppointmentDateListFactory } from '../services/appointment-date-list.factory';
import { AppointmentTimeListFactory } from '../services/appointment-time-list.factory';
import { SelectingAppointmentDateHandler } from './selecting-appointment-date.handler';

describe('SelectingAppointmentDateHandler', () => {
  function buildHandler(
    resolveDoctors: ResolveAvailableAppointmentDoctorsBySpecialtyUseCase,
    resolveTimes: ResolveAvailableAppointmentTimesBySpecialtyAndDateUseCase,
  ): SelectingAppointmentDateHandler {
    return new SelectingAppointmentDateHandler(
      new AppointmentDateListFactory(),
      new AppointmentDoctorListFactory(new AppointmentDoctorListPresenterService()),
      new AppointmentTimeListFactory(),
      new AppointmentAvailabilityMessageFactory(),
      resolveDoctors,
      resolveTimes,
      {
        record: jest.fn().mockResolvedValue(undefined),
      } as unknown as AuditService,
    );
  }

  const baseSession = {
    conversationKey: 'whatsapp:123:573001112233',
    channel: 'whatsapp',
    participantPhone: '573001112233',
    phoneNumberId: '123',
    state: 'SELECTING_APPOINTMENT_DATE',
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
        scope: 'SPECIALTY' as const,
        specialtyOfferedDates: [{ isoDate: '2026-05-06', displayDate: '06/05/2026' }],
        offeredDates: [{ isoDate: '2026-05-06', displayDate: '06/05/2026' }],
      },
    },
    createdAt: '2026-05-04T10:00:00.000Z',
    updatedAt: '2026-05-04T10:00:00.000Z',
  };

  it('moves to time selection and sends interactive list of hours', async () => {
    const resolveTimes = {
      execute: jest.fn().mockResolvedValue({
        hasAvailability: true,
        times: [{ slotRef: '101', timeHHmm: '08:30', displayTime: '08:30 AM' }],
        hasMore: false,
        nextCursorTimeHHmm: undefined,
      }),
    };
    const handler = buildHandler(
      { execute: jest.fn() } as unknown as ResolveAvailableAppointmentDoctorsBySpecialtyUseCase,
      resolveTimes as unknown as ResolveAvailableAppointmentTimesBySpecialtyAndDateUseCase,
    );

    const result = await handler.handle(baseSession as any, {
      kind: 'incoming_message_received',
      messageId: 'wamid-5',
      from: '573001112233',
      timestamp: '1711111115',
      messageType: 'interactive',
      interactiveReplyId: 'appointment_date:2026-05-06',
      interactiveReplyTitle: '06/05/2026',
      phoneNumberId: '123',
    });

    expect(resolveTimes.execute).toHaveBeenCalledWith({
      specialtyCups: '890201',
      appointmentDateIso: '2026-05-06',
      doctorEmployeeCode: null,
    });
    expect(result.nextState).toBe('SELECTING_APPOINTMENT_TIME');
    expect(result.nextContext?.appointmentDateSelection?.selectedDateIso).toBe('2026-05-06');
    expect(result.nextContext?.appointmentTimeSelection?.offeredTimes).toEqual([
      { slotRef: '101', timeHHmm: '08:30', displayTime: '08:30 AM' },
    ]);
  });

  it('routes to doctor selection when choose doctor option is selected', async () => {
    const resolveDoctors = {
      execute: jest.fn().mockResolvedValue({
        hasAvailability: true,
        doctors: [{ employeeCode: 'M001', displayName: 'ANA GARCIA' }],
      }),
    };
    const handler = buildHandler(
      resolveDoctors as unknown as ResolveAvailableAppointmentDoctorsBySpecialtyUseCase,
      { execute: jest.fn() } as unknown as ResolveAvailableAppointmentTimesBySpecialtyAndDateUseCase,
    );

    const result = await handler.handle(baseSession as any, {
      kind: 'incoming_message_received',
      messageId: 'wamid-12',
      from: '573001112233',
      timestamp: '1711111122',
      messageType: 'interactive',
      interactiveReplyId: 'appointment_date:choose_doctor',
      interactiveReplyTitle: 'Elegir medico',
      phoneNumberId: '123',
    });

    expect(result.nextState).toBe('SELECTING_APPOINTMENT_DOCTOR');
    expect(result.nextContext?.appointmentDoctorSelection?.offeredDoctors).toEqual([
      { employeeCode: 'M001', displayName: 'ANA GARCIA' },
    ]);
    expect(result.outboundMessages[0]).toMatchObject({
      type: 'interactive_list',
      body: 'Selecciona el medico con quien deseas agendar.',
    });
  });

  it('adds show more row when use case reports additional times', async () => {
    const handler = buildHandler(
      { execute: jest.fn() } as unknown as ResolveAvailableAppointmentDoctorsBySpecialtyUseCase,
      {
        execute: jest.fn().mockResolvedValue({
          hasAvailability: true,
          times: [
            { slotRef: '101', timeHHmm: '08:00', displayTime: '08:00 AM' },
            { slotRef: '102', timeHHmm: '09:00', displayTime: '09:00 AM' },
          ],
          hasMore: true,
          nextCursorTimeHHmm: '09:00',
        }),
      } as unknown as ResolveAvailableAppointmentTimesBySpecialtyAndDateUseCase,
    );

    const result = await handler.handle(baseSession as any, {
      kind: 'incoming_message_received',
      messageId: 'wamid-5',
      from: '573001112233',
      timestamp: '1711111115',
      messageType: 'interactive',
      interactiveReplyId: 'appointment_date:2026-05-06',
      interactiveReplyTitle: '06/05/2026',
      phoneNumberId: '123',
    });

    expect(result.nextContext?.appointmentTimeSelection).toEqual({
      offeredTimes: [
        { slotRef: '101', timeHHmm: '08:00', displayTime: '08:00 AM' },
        { slotRef: '102', timeHHmm: '09:00', displayTime: '09:00 AM' },
      ],
      hasMoreTimes: true,
      nextCursorTimeHHmm: '09:00',
    });
  });

  it('rebuilds the list when the selected date option is invalid', async () => {
    const handler = buildHandler(
      { execute: jest.fn() } as unknown as ResolveAvailableAppointmentDoctorsBySpecialtyUseCase,
      { execute: jest.fn() } as unknown as ResolveAvailableAppointmentTimesBySpecialtyAndDateUseCase,
    );

    const result = await handler.handle(baseSession as any, {
      kind: 'incoming_message_received',
      messageId: 'wamid-6',
      from: '573001112233',
      timestamp: '1711111116',
      messageType: 'text',
      textBody: 'quiero el primero',
      phoneNumberId: '123',
    });

    expect(result.nextState).toBe('SELECTING_APPOINTMENT_DATE');
    expect(result.outboundMessages[0]).toMatchObject({
      type: 'interactive_list',
      body: 'Selecciona el dia de la cita',
    });
  });

  it('stays in date selection when selected day has no available times', async () => {
    const handler = buildHandler(
      { execute: jest.fn() } as unknown as ResolveAvailableAppointmentDoctorsBySpecialtyUseCase,
      {
        execute: jest.fn().mockResolvedValue({
          hasAvailability: false,
          reason: 'NO_AVAILABILITY',
          times: [],
        }),
      } as unknown as ResolveAvailableAppointmentTimesBySpecialtyAndDateUseCase,
    );

    const result = await handler.handle(baseSession as any, {
      kind: 'incoming_message_received',
      messageId: 'wamid-11',
      from: '573001112233',
      timestamp: '1711111121',
      messageType: 'interactive',
      interactiveReplyId: 'appointment_date:2026-05-06',
      interactiveReplyTitle: '06/05/2026',
      phoneNumberId: '123',
    });

    expect(result.nextState).toBe('SELECTING_APPOINTMENT_DATE');
    expect(result.outboundMessages).toMatchObject([
      {
        type: 'text',
        body: 'No encontramos horas disponibles para el dia 06/05/2026. Selecciona otro dia para continuar.',
      },
      {
        type: 'interactive_list',
        body: 'Selecciona el dia de la cita',
      },
    ]);
  });
});
