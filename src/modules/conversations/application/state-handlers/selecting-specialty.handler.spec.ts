import { FindNearestPendingFutureAppointmentByPatientAndSpecialtyUseCase } from '../../../appointments/application/use-cases/find-nearest-pending-future-appointment-by-patient-and-specialty.use-case';
import { ResolveAvailableAppointmentDatesBySpecialtyUseCase } from '../../../appointments/application/use-cases/resolve-available-appointment-dates-by-specialty.use-case';
import { AuditService } from '../../../audit/application/services/audit.service';
import { AppointmentAvailabilityMessageFactory } from '../services/appointment-availability-message.factory';
import { AppointmentDateListFactory } from '../services/appointment-date-list.factory';
import { PendingAppointmentBlockMessageFactory } from '../services/pending-appointment-block-message.factory';
import { PENDING_APPOINTMENT_BLOCK_OPTION_IDS } from '../services/pending-appointment-block-option-id';
import { SpecialtyListFactory } from '../services/specialty-list.factory';
import { SelectingSpecialtyHandler } from './selecting-specialty.handler';

describe('SelectingSpecialtyHandler', () => {
  const baseSession = {
    conversationKey: 'whatsapp:123:573001112233',
    channel: 'whatsapp',
    participantPhone: '573001112233',
    phoneNumberId: '123',
    state: 'SELECTING_SPECIALTY',
    status: 'BOT_ACTIVE',
    context: {
      patientValidation: {
        failedAttempts: 0,
        patientId: 77,
      },
      specialtySelection: {
        offeredSpecialties: [{ code: '890201', name: 'MEDICINA GENERAL', cups: '890201' }],
      },
    },
    createdAt: '2026-05-04T10:00:00.000Z',
    updatedAt: '2026-05-04T10:00:00.000Z',
  } as const;

  const baseEvent = {
    kind: 'incoming_message_received',
    messageId: 'wamid-4',
    from: '573001112233',
    timestamp: '1711111112',
    messageType: 'interactive',
    interactiveReplyId: 'specialty:890201',
    interactiveReplyTitle: 'MEDICINA GENERAL',
    phoneNumberId: '123',
  } as const;

  it('moves to appointment date selection when availability exists', async () => {
    const pendingUseCase = {
      execute: jest.fn().mockResolvedValue({
        status: 'NOT_FOUND',
      }),
    };
    const handler = new SelectingSpecialtyHandler(
      new SpecialtyListFactory(),
      new AppointmentDateListFactory(),
      new AppointmentAvailabilityMessageFactory(),
      new PendingAppointmentBlockMessageFactory(),
      pendingUseCase as unknown as FindNearestPendingFutureAppointmentByPatientAndSpecialtyUseCase,
      {
        execute: jest.fn().mockResolvedValue({
          hasAvailability: true,
          dates: [{ isoDate: '2026-05-06', displayDate: '06/05/2026' }],
        }),
      } as unknown as ResolveAvailableAppointmentDatesBySpecialtyUseCase,
      {
        record: jest.fn().mockResolvedValue(undefined),
      } as unknown as AuditService,
    );

    const result = await handler.handle(
      baseSession as any,
      baseEvent as any,
    );

    expect(result.nextState).toBe('SELECTING_APPOINTMENT_DATE');
    expect(result.outboundMessages[0]).toMatchObject({ type: 'interactive_list' });
    expect(pendingUseCase.execute).toHaveBeenCalledWith({
      patientId: 77,
      specialtyCups: '890201',
    });
    expect(result.nextContext?.specialtySelection?.selectedSpecialty).toEqual({
      code: '890201',
      name: 'MEDICINA GENERAL',
      cups: '890201',
    });
    expect(result.nextContext?.appointmentDateSelection?.offeredDates).toEqual([
      { isoDate: '2026-05-06', displayDate: '06/05/2026' },
    ]);
  });

  it('returns to main menu with action buttons when no dates are available', async () => {
    const pendingUseCase = {
      execute: jest.fn().mockResolvedValue({
        status: 'NOT_FOUND',
      }),
    };
    const handler = new SelectingSpecialtyHandler(
      new SpecialtyListFactory(),
      new AppointmentDateListFactory(),
      new AppointmentAvailabilityMessageFactory(),
      new PendingAppointmentBlockMessageFactory(),
      pendingUseCase as unknown as FindNearestPendingFutureAppointmentByPatientAndSpecialtyUseCase,
      {
        execute: jest.fn().mockResolvedValue({
          hasAvailability: false,
          reason: 'NO_AVAILABILITY',
          dates: [],
        }),
      } as unknown as ResolveAvailableAppointmentDatesBySpecialtyUseCase,
      {
        record: jest.fn().mockResolvedValue(undefined),
      } as unknown as AuditService,
    );

    const result = await handler.handle(
      baseSession as any,
      {
        ...baseEvent,
        messageId: 'wamid-7',
        timestamp: '1711111117',
      } as any,
    );

    expect(result.nextState).toBe('MAIN_MENU');
    expect(result.outboundMessages[0]).toMatchObject({
      type: 'interactive_buttons',
      buttons: [
        { id: 'nav_main_menu', title: 'Menu principal' },
        { id: 'nav_finish', title: 'Finalizar' },
      ],
    });
  });

  it('blocks the flow with interactive buttons when nearest pending appointment exists', async () => {
    const handler = new SelectingSpecialtyHandler(
      new SpecialtyListFactory(),
      new AppointmentDateListFactory(),
      new AppointmentAvailabilityMessageFactory(),
      new PendingAppointmentBlockMessageFactory(),
      {
        execute: jest.fn().mockResolvedValue({
          status: 'FOUND',
          appointment: {
            slotRef: '101',
            patientFullName: 'MARIA FERNANDA PEREZ LOPEZ',
            appointmentDateIso: '2026-05-30',
            appointmentTimeHHmm: '11:40',
            appointmentDisplayTime: '11:40 AM',
            modality: 'PRESENCIAL',
            professionalName: 'ALICAN MARIA ZAMBRANO PIZARRO',
            siteName: 'Santa Marta',
            siteAddress: 'Carrera 19',
          },
        }),
      } as unknown as FindNearestPendingFutureAppointmentByPatientAndSpecialtyUseCase,
      {
        execute: jest.fn(),
      } as unknown as ResolveAvailableAppointmentDatesBySpecialtyUseCase,
      {
        record: jest.fn().mockResolvedValue(undefined),
      } as unknown as AuditService,
    );

    const result = await handler.handle(
      baseSession as any,
      {
        ...baseEvent,
        messageId: 'wamid-8',
      } as any,
    );

    expect(result.nextState).toBe('SELECTING_SPECIALTY');
    expect(result.outboundMessages[0]).toMatchObject({
      type: 'interactive_buttons',
      buttons: [
        {
          id: PENDING_APPOINTMENT_BLOCK_OPTION_IDS.BACK_TO_SPECIALTIES,
          title: '↩ Volver',
        },
        { id: 'nav_main_menu', title: 'Menu principal' },
        { id: 'nav_finish', title: 'Finalizar' },
      ],
    });
  });

  it('rebuilds specialty list when patient taps back from pending-block message', async () => {
    const handler = new SelectingSpecialtyHandler(
      new SpecialtyListFactory(),
      new AppointmentDateListFactory(),
      new AppointmentAvailabilityMessageFactory(),
      new PendingAppointmentBlockMessageFactory(),
      {
        execute: jest.fn(),
      } as unknown as FindNearestPendingFutureAppointmentByPatientAndSpecialtyUseCase,
      {
        execute: jest.fn(),
      } as unknown as ResolveAvailableAppointmentDatesBySpecialtyUseCase,
      {
        record: jest.fn().mockResolvedValue(undefined),
      } as unknown as AuditService,
    );

    const result = await handler.handle(
      baseSession as any,
      {
        ...baseEvent,
        interactiveReplyId: PENDING_APPOINTMENT_BLOCK_OPTION_IDS.BACK_TO_SPECIALTIES,
      } as any,
    );

    expect(result.nextState).toBe('SELECTING_SPECIALTY');
    expect(result.outboundMessages[0]).toMatchObject({
      type: 'interactive_list',
      body: 'Seleccione la especialidad que desea agendar.',
    });
  });
});
