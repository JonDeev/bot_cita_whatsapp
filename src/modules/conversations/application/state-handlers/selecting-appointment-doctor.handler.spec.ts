import { ResolveAvailableAppointmentDatesBySpecialtyUseCase } from '../../../appointments/application/use-cases/resolve-available-appointment-dates-by-specialty.use-case';
import { AuditService } from '../../../audit/application/services/audit.service';
import { AppointmentDoctorListFactory } from '../services/appointment-doctor-list.factory';
import { AppointmentDoctorListPresenterService } from '../services/appointment-doctor-list-presenter.service';
import { AppointmentDateListFactory } from '../services/appointment-date-list.factory';
import { SelectingAppointmentDoctorHandler } from './selecting-appointment-doctor.handler';

describe('SelectingAppointmentDoctorHandler', () => {
  function buildHandler(
    resolveDates: ResolveAvailableAppointmentDatesBySpecialtyUseCase,
  ): SelectingAppointmentDoctorHandler {
    return new SelectingAppointmentDoctorHandler(
      new AppointmentDoctorListFactory(
        new AppointmentDoctorListPresenterService(),
      ),
      new AppointmentDateListFactory(),
      resolveDates,
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
    state: 'SELECTING_APPOINTMENT_DOCTOR',
    status: 'BOT_ACTIVE',
    context: {
      specialtySelection: {
        offeredSpecialties: [
          { code: '890201', name: 'MEDICINA GENERAL', cups: '890201' },
        ],
        selectedSpecialty: {
          code: '890201',
          name: 'MEDICINA GENERAL',
          cups: '890201',
        },
      },
      appointmentDoctorSelection: {
        offeredDoctors: [{ employeeCode: 'M001', displayName: 'ANA GARCIA' }],
      },
      appointmentDateSelection: {
        scope: 'SPECIALTY' as const,
        specialtyOfferedDates: [
          { isoDate: '2026-05-06', displayDate: '06/05/2026' },
        ],
        offeredDates: [{ isoDate: '2026-05-06', displayDate: '06/05/2026' }],
      },
    },
    createdAt: '2026-05-04T10:00:00.000Z',
    updatedAt: '2026-05-04T10:00:00.000Z',
  };

  it('moves to doctor-filtered date selection after choosing a doctor', async () => {
    const resolveDates = {
      execute: jest.fn().mockResolvedValue({
        hasAvailability: true,
        dates: [{ isoDate: '2026-05-08', displayDate: '08/05/2026' }],
      }),
    };
    const handler = buildHandler(
      resolveDates as unknown as ResolveAvailableAppointmentDatesBySpecialtyUseCase,
    );

    const result = await handler.handle(baseSession as any, {
      kind: 'incoming_message_received',
      messageId: 'wamid-13',
      from: '573001112233',
      timestamp: '1711111123',
      messageType: 'interactive',
      interactiveReplyId: 'appointment_doctor:M001',
      interactiveReplyTitle: 'ANA GARCIA',
      phoneNumberId: '123',
    });

    expect(resolveDates.execute).toHaveBeenCalledWith({
      specialtyCups: '890201',
      doctorEmployeeCode: 'M001',
    });
    expect(result.nextState).toBe('SELECTING_APPOINTMENT_DATE');
    expect(
      result.nextContext?.appointmentDoctorSelection?.selectedDoctor,
    ).toEqual({
      employeeCode: 'M001',
      displayName: 'ANA GARCIA',
    });
    expect(result.nextContext?.appointmentDateSelection).toEqual({
      scope: 'DOCTOR',
      specialtyOfferedDates: [
        { isoDate: '2026-05-06', displayDate: '06/05/2026' },
      ],
      offeredDates: [{ isoDate: '2026-05-08', displayDate: '08/05/2026' }],
    });
  });

  it('stays in doctor selection when chosen doctor has no dates available', async () => {
    const handler = buildHandler({
      execute: jest.fn().mockResolvedValue({
        hasAvailability: false,
        reason: 'NO_AVAILABILITY',
        dates: [],
      }),
    } as unknown as ResolveAvailableAppointmentDatesBySpecialtyUseCase);

    const result = await handler.handle(baseSession as any, {
      kind: 'incoming_message_received',
      messageId: 'wamid-14',
      from: '573001112233',
      timestamp: '1711111124',
      messageType: 'interactive',
      interactiveReplyId: 'appointment_doctor:M001',
      interactiveReplyTitle: 'ANA GARCIA',
      phoneNumberId: '123',
    });

    expect(result.nextState).toBe('SELECTING_APPOINTMENT_DOCTOR');
    expect(result.outboundMessages).toMatchObject([
      {
        type: 'text',
        body: 'No encontramos fechas disponibles para el medico seleccionado. Elige otro medico para continuar.',
      },
      {
        type: 'interactive_list',
        body: 'Selecciona el medico con quien deseas agendar.',
      },
    ]);
  });
});
