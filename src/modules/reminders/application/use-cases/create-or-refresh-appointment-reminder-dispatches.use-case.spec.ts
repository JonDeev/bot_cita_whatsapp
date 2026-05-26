import { AuditService } from '../../../audit/application/services/audit.service';
import { CreateOrRefreshAppointmentReminderDispatchesUseCase } from './create-or-refresh-appointment-reminder-dispatches.use-case';
import { AppointmentReminderAppointmentTimeService } from '../services/appointment-reminder-appointment-time.service';
import { AppointmentReminderWindowService } from '../services/appointment-reminder-window.service';

describe('CreateOrRefreshAppointmentReminderDispatchesUseCase', () => {
  it('creates dispatches and schedules delayed jobs for valid phones', async () => {
    const eligibilityRepository = {
      findFutureAssignedAppointments: jest.fn().mockResolvedValue([
        {
          legacyAgendaId: 100,
          patientLegacyUserId: 10,
          patientPhoneRaw: '3001234567',
          patientFirstName: 'ADRIANA',
          patientLastName: 'RUIZ',
          patientPhoneVerifiedAtIso: null,
          appointmentDateIso: '2026-05-27T00:00:00.000Z',
          appointmentTimeHhmm: '15:00',
          legacyState: 'Asignada',
          modalityId: 0,
          specialtyName: 'MEDICINA GENERAL',
          doctorName: 'MEDICO',
          siteCity: 'SANTA MARTA',
          siteAddress: 'CALLE 1',
        },
      ]),
    };

    const dispatchRepository = {
      upsertDispatch: jest.fn().mockResolvedValue({
        wasCreated: true,
        dispatch: {
          id: 501,
        },
      }),
      markOlderPendingDispatchesAsRescheduled: jest.fn().mockResolvedValue(0),
    };

    const dispatchQueue = {
      scheduleDispatchJob: jest.fn().mockResolvedValue(undefined),
    };

    const configService = {
      getMaxEligibilityWindowHours: jest.fn().mockReturnValue(72),
      getEligibilityLimit: jest.fn().mockReturnValue(500),
      isQueueEnabled: jest.fn().mockReturnValue(true),
    };

    const phoneNormalizer = {
      normalizeLegacyPhone: jest.fn().mockReturnValue('3001234567'),
      toE164Colombia: jest.fn().mockReturnValue('573001234567'),
    };

    const templateConfig = {
      getReminderType: jest.fn().mockReturnValue('APPOINTMENT_24H'),
      getReminderTemplateName: jest.fn().mockReturnValue('recordatorio_cita_24h'),
      getVerificationTemplateName: jest
        .fn()
        .mockReturnValue('verificacion_telefono_paciente'),
    };

    const auditService = {
      record: jest.fn().mockResolvedValue(undefined),
    } as unknown as AuditService;

    const useCase = new CreateOrRefreshAppointmentReminderDispatchesUseCase(
      eligibilityRepository as any,
      dispatchRepository as any,
      dispatchQueue as any,
      auditService,
      configService as any,
      phoneNormalizer as any,
      new AppointmentReminderWindowService(),
      new AppointmentReminderAppointmentTimeService(),
      templateConfig as any,
    );

    const result = await useCase.execute({ runAtIso: '2026-05-26T15:00:00.000Z' });

    expect(dispatchRepository.upsertDispatch).toHaveBeenCalledTimes(1);
    expect(dispatchQueue.scheduleDispatchJob).toHaveBeenCalledWith(
      expect.objectContaining({
        dispatchId: 501,
      }),
    );
    expect(result).toEqual({
      scanned: 1,
      created: 1,
      refreshed: 0,
      rescheduledPrevious: 0,
      skippedInvalidPhone: 0,
    });
  });
});
