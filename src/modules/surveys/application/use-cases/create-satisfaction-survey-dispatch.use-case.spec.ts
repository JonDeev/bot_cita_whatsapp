import { AuditService } from '../../../audit/application/services/audit.service';
import { CreateSatisfactionSurveyDispatchUseCase } from './create-satisfaction-survey-dispatch.use-case';
import { SurveyWhatsappPhoneNormalizerService } from '../services/survey-whatsapp-phone-normalizer.service';

describe('CreateSatisfactionSurveyDispatchUseCase', () => {
  it('normalizes the patient phone and records a created audit event', async () => {
    const repository = {
      createOrGetDailyDispatch: jest.fn().mockResolvedValue({
        wasCreated: true,
        dispatch: {
          id: 11,
          surveyDefinitionId: 1,
          patientLegacyUserId: 91,
          patientName: 'Adriana',
          patientPhone: '3001112233',
          patientPhoneE164: '573001112233',
          surveyDateIso: '2026-05-10',
          status: 'PENDING',
          dedupeKey: 'survey:91:2026-05-10',
          expiresAtIso: '2026-05-11T07:30:00.000Z',
          conversationKey: null,
          initialTemplateName: null,
          initialTemplateLanguage: null,
          flowToken: null,
          appointments: [
            {
              legacyAgendaId: 1001,
              appointmentDateIso: '2026-05-10',
              appointmentTimeHhmm: '07:30',
              specialtyName: 'MEDICINA GENERAL',
            },
          ],
        },
      }),
    };
    const auditService = {
      record: jest.fn().mockResolvedValue(undefined),
    } as unknown as AuditService;

    const useCase = new CreateSatisfactionSurveyDispatchUseCase(
      repository as any,
      auditService,
      new SurveyWhatsappPhoneNormalizerService(),
    );

    const result = await useCase.execute({
      patientLegacyUserId: 91,
      patientName: 'Adriana',
      patientPhone: '(300) 111-2233',
      surveyDateIso: '2026-05-10',
      triggerType: 'POST_APPOINTMENT_HALF_HOUR_BATCH',
      windowStartIso: '2026-05-10T07:00:00.000Z',
      windowEndIso: '2026-05-10T07:30:00.000Z',
      expiresAtIso: '2026-05-11T07:30:00.000Z',
      appointments: [
        {
          legacyAgendaId: 1001,
          appointmentDateIso: '2026-05-10',
          appointmentTimeHhmm: '07:30',
          specialtyName: 'MEDICINA GENERAL',
        },
      ],
    });

    expect(repository.createOrGetDailyDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        patientPhone: '3001112233',
        patientPhoneE164: '573001112233',
        dedupeKey: 'survey:91:2026-05-10',
      }),
    );
    expect(auditService.record).toHaveBeenCalledWith(
      'survey.dispatch.created',
      {
        dispatchId: 11,
        patientLegacyUserId: 91,
        surveyDate: '2026-05-10',
        appointmentCount: 1,
        status: 'PENDING',
        wasCreated: true,
      },
    );
    expect(result.dispatch.id).toBe(11);
  });
});
