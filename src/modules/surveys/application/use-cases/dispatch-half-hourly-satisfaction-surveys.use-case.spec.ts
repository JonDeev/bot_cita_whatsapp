import { AuditService } from '../../../audit/application/services/audit.service';
import { SATISFACTION_SURVEY_LEGACY_NOTIFICATION_STATUSES } from '../../domain/ports/satisfaction-survey-legacy-status.repository';
import { DispatchHalfHourlySatisfactionSurveysUseCase } from './dispatch-half-hourly-satisfaction-surveys.use-case';
import { CreateSatisfactionSurveyDispatchUseCase } from './create-satisfaction-survey-dispatch.use-case';
import { SendSatisfactionSurveyFlowInvitationUseCase } from './send-satisfaction-survey-flow-invitation.use-case';
import { SatisfactionSurveyDispatchWindowService } from '../services/satisfaction-survey-dispatch-window.service';
import { SurveyWhatsappPhoneNormalizerService } from '../services/survey-whatsapp-phone-normalizer.service';

describe('DispatchHalfHourlySatisfactionSurveysUseCase', () => {
  it('skips execution outside the configured half-hour schedule', async () => {
    const auditService = {
      record: jest.fn().mockResolvedValue(undefined),
    } as unknown as AuditService;

    const useCase = new DispatchHalfHourlySatisfactionSurveysUseCase(
      { findEligibleAppointmentsByWindow: jest.fn() },
      { updateAgendaSurveyNotificationStatus: jest.fn() },
      {
        hasGrantedSatisfactionSurveyConsent: jest.fn(),
        isPhoneSuppressedForSatisfactionSurveys: jest.fn(),
      },
      new SatisfactionSurveyDispatchWindowService(),
      {
        resolveStoredSnapshot: jest.fn().mockResolvedValue({
          dispatchEnabled: true,
          scheduleProfile: 'business_hours_mon_fri',
          expirationHours: 24,
          eligibilityLimit: 500,
          maxDispatchesPerRun: 50,
        }),
      } as any,
      {
        execute: jest.fn(),
      } as unknown as CreateSatisfactionSurveyDispatchUseCase,
      {
        execute: jest.fn(),
      } as unknown as SendSatisfactionSurveyFlowInvitationUseCase,
      new SurveyWhatsappPhoneNormalizerService(),
      auditService,
    );

    const result = await useCase.execute({
      runAtIso: '2026-05-11T12:45:00.000Z',
    });

    expect(result.skipped).toBe(true);
    expect(result.skipReason).toContain('half-hour execution schedule');
  });

  it('creates and sends dispatches while marking non-applicable agendas from the cumulative day window', async () => {
    const eligibilityRepository = {
      findEligibleAppointmentsByWindow: jest.fn().mockResolvedValue([
        {
          legacyAgendaId: 101,
          patientLegacyUserId: 11,
          patientName: 'Adriana Romero',
          patientPhone: '3001112233',
          appointmentDateIso: '2026-05-11',
          appointmentTimeHhmm: '07:20',
          specialtyName: 'MEDICINA GENERAL',
          doctorName: 'Carlos Perez',
          siteName: 'Sede Norte',
        },
        {
          legacyAgendaId: 102,
          patientLegacyUserId: 12,
          patientName: 'Paciente Sin Consentimiento',
          patientPhone: '3009998888',
          appointmentDateIso: '2026-05-11',
          appointmentTimeHhmm: '07:25',
          specialtyName: 'MEDICINA GENERAL',
          doctorName: 'Carlos Perez',
          siteName: 'Sede Norte',
        },
      ]),
    };

    const legacyStatusRepository = {
      updateAgendaSurveyNotificationStatus: jest
        .fn()
        .mockResolvedValueOnce(1)
        .mockResolvedValueOnce(1),
    };

    const policyRepository = {
      hasGrantedSatisfactionSurveyConsent: jest
        .fn()
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false),
      isPhoneSuppressedForSatisfactionSurveys: jest
        .fn()
        .mockResolvedValue(false),
    };

    const createSurveyDispatch = {
      execute: jest.fn().mockResolvedValue({
        wasCreated: true,
        dispatch: {
          id: 55,
          surveyDefinitionId: 1,
          status: 'PENDING',
          appointments: [{ legacyAgendaId: 101 }],
        },
      }),
    } as unknown as CreateSatisfactionSurveyDispatchUseCase;

    const sendSurveyFlowInvitation = {
      execute: jest.fn().mockResolvedValue({ messageId: 'wamid-123' }),
    } as unknown as SendSatisfactionSurveyFlowInvitationUseCase;

    const auditService = {
      record: jest.fn().mockResolvedValue(undefined),
    } as unknown as AuditService;

    const useCase = new DispatchHalfHourlySatisfactionSurveysUseCase(
      eligibilityRepository,
      legacyStatusRepository,
      policyRepository,
      new SatisfactionSurveyDispatchWindowService(),
      {
        resolveStoredSnapshot: jest.fn().mockResolvedValue({
          dispatchEnabled: true,
          scheduleProfile: 'business_hours_mon_fri',
          expirationHours: 24,
          eligibilityLimit: 500,
          maxDispatchesPerRun: 50,
        }),
      } as any,
      createSurveyDispatch,
      sendSurveyFlowInvitation,
      new SurveyWhatsappPhoneNormalizerService(),
      auditService,
    );

    const result = await useCase.execute({
      runAtIso: '2026-05-11T13:30:00.000Z',
    });

    expect(result.skipped).toBe(false);
    expect(result.eligibleAppointments).toBe(2);
    expect(result.createdDispatches).toBe(1);
    expect(result.sentDispatches).toBe(1);
    expect(result.markedAsNotApplicable).toBe(1);
    expect(result.markedAsSent).toBe(1);

    expect(
      eligibilityRepository.findEligibleAppointmentsByWindow,
    ).toHaveBeenCalledWith({
      surveyDateIso: '2026-05-11',
      windowStartHHmm: '07:00',
      windowEndHHmm: '08:30',
      limit: 500,
    });

    expect(
      legacyStatusRepository.updateAgendaSurveyNotificationStatus,
    ).toHaveBeenCalledWith({
      legacyAgendaIds: [102],
      status: SATISFACTION_SURVEY_LEGACY_NOTIFICATION_STATUSES.NOT_APPLICABLE,
    });
    expect(
      legacyStatusRepository.updateAgendaSurveyNotificationStatus,
    ).toHaveBeenCalledWith({
      legacyAgendaIds: [101],
      status: SATISFACTION_SURVEY_LEGACY_NOTIFICATION_STATUSES.SENT,
    });
  });

  it('uses the cumulative day window at 11:30 and completes the happy path', async () => {
    const eligibilityRepository = {
      findEligibleAppointmentsByWindow: jest.fn().mockResolvedValue([
        {
          legacyAgendaId: 201,
          patientLegacyUserId: 21,
          patientName: 'Paciente Valido',
          patientPhone: '3002223344',
          appointmentDateIso: '2026-06-23',
          appointmentTimeHhmm: '10:45',
          specialtyName: 'MEDICINA GENERAL',
          doctorName: 'Dra. Example',
          siteName: 'Sede Centro',
        },
      ]),
    };

    const legacyStatusRepository = {
      updateAgendaSurveyNotificationStatus: jest.fn().mockResolvedValue(1),
    };

    const policyRepository = {
      hasGrantedSatisfactionSurveyConsent: jest.fn().mockResolvedValue(true),
      isPhoneSuppressedForSatisfactionSurveys: jest
        .fn()
        .mockResolvedValue(false),
    };

    const createSurveyDispatch = {
      execute: jest.fn().mockResolvedValue({
        wasCreated: true,
        dispatch: {
          id: 77,
          surveyDefinitionId: 1,
          status: 'PENDING',
          appointments: [{ legacyAgendaId: 201 }],
        },
      }),
    } as unknown as CreateSatisfactionSurveyDispatchUseCase;

    const sendSurveyFlowInvitation = {
      execute: jest.fn().mockResolvedValue({ messageId: 'wamid-456' }),
    } as unknown as SendSatisfactionSurveyFlowInvitationUseCase;

    const auditService = {
      record: jest.fn().mockResolvedValue(undefined),
    } as unknown as AuditService;

    const useCase = new DispatchHalfHourlySatisfactionSurveysUseCase(
      eligibilityRepository,
      legacyStatusRepository,
      policyRepository,
      new SatisfactionSurveyDispatchWindowService(),
      {
        resolveStoredSnapshot: jest.fn().mockResolvedValue({
          dispatchEnabled: true,
          scheduleProfile: 'business_hours_mon_fri',
          expirationHours: 24,
          eligibilityLimit: 500,
          maxDispatchesPerRun: 50,
        }),
      } as any,
      createSurveyDispatch,
      sendSurveyFlowInvitation,
      new SurveyWhatsappPhoneNormalizerService(),
      auditService,
    );

    const result = await useCase.execute({
      runAtIso: '2026-06-23T16:30:00.000Z',
    });

    expect(result.skipped).toBe(false);
    expect(result.eligibleAppointments).toBe(1);
    expect(result.createdDispatches).toBe(1);
    expect(result.sentDispatches).toBe(1);
    expect(result.markedAsNotApplicable).toBe(0);
    expect(result.markedAsSent).toBe(1);

    expect(
      eligibilityRepository.findEligibleAppointmentsByWindow,
    ).toHaveBeenCalledWith({
      surveyDateIso: '2026-06-23',
      windowStartHHmm: '07:00',
      windowEndHHmm: '11:30',
      limit: 500,
    });

    expect(createSurveyDispatch.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        patientLegacyUserId: 21,
        surveyDateIso: '2026-06-23',
        windowStartIso: '2026-06-23T12:00:00.000Z',
        windowEndIso: '2026-06-23T16:30:00.000Z',
      }),
    );

    expect(
      legacyStatusRepository.updateAgendaSurveyNotificationStatus,
    ).toHaveBeenCalledWith({
      legacyAgendaIds: [201],
      status: SATISFACTION_SURVEY_LEGACY_NOTIFICATION_STATUSES.SENT,
    });
  });
});
