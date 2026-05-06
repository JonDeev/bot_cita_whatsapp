import { ResolveAvailableAppointmentTimesBySpecialtyAndDateUseCase } from '../../../appointments/application/use-cases/resolve-available-appointment-times-by-specialty-and-date.use-case';
import { AuditService } from '../../../audit/application/services/audit.service';
import { AppointmentAvailabilityMessageFactory } from '../services/appointment-availability-message.factory';
import { AppointmentDateListFactory } from '../services/appointment-date-list.factory';
import { AppointmentTimeListFactory } from '../services/appointment-time-list.factory';
import { SelectingAppointmentDateHandler } from './selecting-appointment-date.handler';

describe('SelectingAppointmentDateHandler', () => {
  function buildHandler(
    resolveTimes: ResolveAvailableAppointmentTimesBySpecialtyAndDateUseCase,
  ): SelectingAppointmentDateHandler {
    return new SelectingAppointmentDateHandler(
      new AppointmentDateListFactory(),
      new AppointmentTimeListFactory(),
      new AppointmentAvailabilityMessageFactory(),
      resolveTimes,
      {
        record: jest.fn().mockResolvedValue(undefined),
      } as unknown as AuditService,
    );
  }

  it('moves to time selection and sends interactive list of hours', async () => {
    const handler = buildHandler({
      execute: jest.fn().mockResolvedValue({
        hasAvailability: true,
        times: [{ slotRef: '101', timeHHmm: '08:30', displayTime: '08:30 AM' }],
        hasMore: false,
        nextCursorTimeHHmm: undefined,
      }),
    } as unknown as ResolveAvailableAppointmentTimesBySpecialtyAndDateUseCase);

    const result = await handler.handle(
      {
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
            offeredDates: [{ isoDate: '2026-05-06', displayDate: '06/05/2026' }],
          },
        },
        createdAt: '2026-05-04T10:00:00.000Z',
        updatedAt: '2026-05-04T10:00:00.000Z',
      },
      {
        kind: 'incoming_message_received',
        messageId: 'wamid-5',
        from: '573001112233',
        timestamp: '1711111115',
        messageType: 'interactive',
        interactiveReplyId: 'appointment_date:2026-05-06',
        interactiveReplyTitle: '06/05/2026',
        phoneNumberId: '123',
      },
    );

    expect(result.nextState).toBe('SELECTING_APPOINTMENT_TIME');
    expect(result.nextContext?.appointmentDateSelection?.selectedDateIso).toBe('2026-05-06');
    expect(result.nextContext?.appointmentTimeSelection?.offeredTimes).toEqual([
      { slotRef: '101', timeHHmm: '08:30', displayTime: '08:30 AM' },
    ]);
    expect(result.nextContext?.appointmentTimeSelection?.hasMoreTimes).toBe(false);
    expect(result.outboundMessages[0]).toMatchObject({
      type: 'interactive_list',
      body: 'Selecciona la hora de la cita',
    });
  });

  it('adds show more row when use case reports additional times', async () => {
    const handler = buildHandler({
      execute: jest.fn().mockResolvedValue({
        hasAvailability: true,
        times: [
          { slotRef: '101', timeHHmm: '08:00', displayTime: '08:00 AM' },
          { slotRef: '102', timeHHmm: '09:00', displayTime: '09:00 AM' },
        ],
        hasMore: true,
        nextCursorTimeHHmm: '09:00',
      }),
    } as unknown as ResolveAvailableAppointmentTimesBySpecialtyAndDateUseCase);

    const result = await handler.handle(
      {
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
            offeredDates: [{ isoDate: '2026-05-06', displayDate: '06/05/2026' }],
          },
        },
        createdAt: '2026-05-04T10:00:00.000Z',
        updatedAt: '2026-05-04T10:00:00.000Z',
      },
      {
        kind: 'incoming_message_received',
        messageId: 'wamid-5',
        from: '573001112233',
        timestamp: '1711111115',
        messageType: 'interactive',
        interactiveReplyId: 'appointment_date:2026-05-06',
        interactiveReplyTitle: '06/05/2026',
        phoneNumberId: '123',
      },
    );

    expect(result.nextContext?.appointmentTimeSelection).toEqual({
      offeredTimes: [
        { slotRef: '101', timeHHmm: '08:00', displayTime: '08:00 AM' },
        { slotRef: '102', timeHHmm: '09:00', displayTime: '09:00 AM' },
      ],
      hasMoreTimes: true,
      nextCursorTimeHHmm: '09:00',
    });
    expect(result.outboundMessages[0]).toMatchObject({
      type: 'interactive_list',
      sections: [
        {
          rows: [
            { id: 'appointment_time:101', title: '08:00 AM' },
            { id: 'appointment_time:102', title: '09:00 AM' },
            { id: 'appointment_time:show_more', title: 'Mostrar mas' },
          ],
        },
      ],
    });
  });

  it('rebuilds the list when the selected date option is invalid', async () => {
    const handler = buildHandler({
      execute: jest.fn(),
    } as unknown as ResolveAvailableAppointmentTimesBySpecialtyAndDateUseCase);

    const result = await handler.handle(
      {
        conversationKey: 'whatsapp:123:573001112233',
        channel: 'whatsapp',
        participantPhone: '573001112233',
        phoneNumberId: '123',
        state: 'SELECTING_APPOINTMENT_DATE',
        status: 'BOT_ACTIVE',
        context: {
          appointmentDateSelection: {
            offeredDates: [{ isoDate: '2026-05-06', displayDate: '06/05/2026' }],
          },
        },
        createdAt: '2026-05-04T10:00:00.000Z',
        updatedAt: '2026-05-04T10:00:00.000Z',
      },
      {
        kind: 'incoming_message_received',
        messageId: 'wamid-6',
        from: '573001112233',
        timestamp: '1711111116',
        messageType: 'text',
        textBody: 'quiero el primero',
        phoneNumberId: '123',
      },
    );

    expect(result.nextState).toBe('SELECTING_APPOINTMENT_DATE');
    expect(result.outboundMessages[0]).toMatchObject({
      type: 'interactive_list',
      body: 'Selecciona el dia de la cita',
    });
  });

  it('stays in date selection when selected day has no available times', async () => {
    const handler = buildHandler({
      execute: jest.fn().mockResolvedValue({
        hasAvailability: false,
        reason: 'NO_AVAILABILITY',
        times: [],
      }),
    } as unknown as ResolveAvailableAppointmentTimesBySpecialtyAndDateUseCase);

    const result = await handler.handle(
      {
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
            offeredDates: [{ isoDate: '2026-05-06', displayDate: '06/05/2026' }],
          },
        },
        createdAt: '2026-05-04T10:00:00.000Z',
        updatedAt: '2026-05-04T10:00:00.000Z',
      },
      {
        kind: 'incoming_message_received',
        messageId: 'wamid-11',
        from: '573001112233',
        timestamp: '1711111121',
        messageType: 'interactive',
        interactiveReplyId: 'appointment_date:2026-05-06',
        interactiveReplyTitle: '06/05/2026',
        phoneNumberId: '123',
      },
    );

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
