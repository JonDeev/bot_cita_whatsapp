import { AuditService } from '../../../audit/application/services/audit.service';
import { ConversationKeyFactory } from '../../../conversations/application/services/conversation-key.factory';
import { SATISFACTION_SURVEY_LEGACY_NOTIFICATION_STATUSES } from '../../domain/ports/satisfaction-survey-legacy-status.repository';
import { RecordSatisfactionSurveyFlowSubmissionUseCase } from './record-satisfaction-survey-flow-submission.use-case';

describe('RecordSatisfactionSurveyFlowSubmissionUseCase', () => {
  const event = {
    kind: 'incoming_message_received' as const,
    messageId: 'wamid-flow-response',
    from: '573001112233',
    timestamp: '1711111116',
    messageType: 'interactive',
    phoneNumberId: '112260851488328',
    interactiveFlowToken: 'survey_dispatch:99:2026-05-11',
    interactiveFlowResponse: {
      survey_decision: '1',
      q1: '1',
      q2: '4',
      q3: '1',
      q4: '5',
      q5_comment: 'Excelente atencion',
    },
  };

  it('marks dispatch completed and writes answers', async () => {
    const surveyDispatchRepository = {
      findByFlowToken: jest.fn().mockResolvedValue({
        id: 99,
        surveyDefinitionId: 1,
        patientLegacyUserId: 77,
        patientName: 'Adriana',
        patientPhone: '3001112233',
        patientPhoneE164: '573001112233',
        surveyDateIso: '2026-05-11',
        status: 'SENT',
        dedupeKey: 'survey:77:2026-05-11',
        expiresAtIso: '2026-05-12T07:30:00.000Z',
        conversationKey: null,
        initialTemplateName: 'satisfaction_survey_flow',
        initialTemplateLanguage: 'es_CO',
        flowToken: 'survey_dispatch:99:2026-05-11',
        appointments: [
          {
            legacyAgendaId: 601,
            appointmentDateIso: '2026-05-11',
            appointmentTimeHhmm: '07:15',
          },
        ],
      }),
      findById: jest.fn().mockResolvedValue({
        appointments: [{ legacyAgendaId: 601 }],
      }),
      markStarted: jest.fn().mockResolvedValue(undefined),
      saveAnswerByQuestionKey: jest.fn().mockResolvedValue(undefined),
      markCompleted: jest.fn().mockResolvedValue(undefined),
    };

    const legacyStatusRepository = {
      updateAgendaSurveyNotificationStatus: jest.fn().mockResolvedValue(1),
    };

    const conversationMessageRepository = {
      saveInbound: jest.fn().mockResolvedValue(undefined),
    };

    const auditService = {
      record: jest.fn().mockResolvedValue(undefined),
    } as unknown as AuditService;

    const useCase = new RecordSatisfactionSurveyFlowSubmissionUseCase(
      surveyDispatchRepository as any,
      legacyStatusRepository,
      conversationMessageRepository as any,
      {
        getFieldMap: jest.fn(() => ({
          decision: 'survey_decision',
          q1: 'q1',
          q2: 'q2',
          q3: 'q3',
          q4: 'q4',
          q5Comment: 'q5_comment',
        })),
      } as any,
      new ConversationKeyFactory(),
      auditService,
    );

    const result = await useCase.execute(event);

    expect(result).toEqual({ handled: true });
    expect(surveyDispatchRepository.markCompleted).toHaveBeenCalled();
    expect(
      legacyStatusRepository.updateAgendaSurveyNotificationStatus,
    ).toHaveBeenCalledWith({
      legacyAgendaIds: [601],
      status: SATISFACTION_SURVEY_LEGACY_NOTIFICATION_STATUSES.ANSWERED,
    });
    expect(
      surveyDispatchRepository.saveAnswerByQuestionKey,
    ).toHaveBeenCalledTimes(5);
  });

  it('blocks contact when flow marks unknown person', async () => {
    const surveyDispatchRepository = {
      findByFlowToken: jest.fn().mockResolvedValue({
        id: 100,
        surveyDefinitionId: 1,
        patientLegacyUserId: 88,
        patientName: 'Paciente',
        patientPhone: '3002223344',
        patientPhoneE164: null,
        surveyDateIso: '2026-05-11',
        status: 'SENT',
        dedupeKey: 'survey:88:2026-05-11',
        expiresAtIso: '2026-05-12T07:30:00.000Z',
        conversationKey: null,
        initialTemplateName: null,
        initialTemplateLanguage: null,
        flowToken: 'survey_dispatch:100:2026-05-11',
        appointments: [
          {
            legacyAgendaId: 602,
            appointmentDateIso: '2026-05-11',
            appointmentTimeHhmm: '07:20',
          },
        ],
      }),
      findById: jest.fn().mockResolvedValue({
        appointments: [{ legacyAgendaId: 602 }],
      }),
      markStarted: jest.fn().mockResolvedValue(undefined),
      markBlockedContact: jest.fn().mockResolvedValue(undefined),
      upsertContactSuppression: jest.fn().mockResolvedValue(undefined),
    };

    const legacyStatusRepository = {
      updateAgendaSurveyNotificationStatus: jest.fn().mockResolvedValue(1),
    };

    const useCase = new RecordSatisfactionSurveyFlowSubmissionUseCase(
      surveyDispatchRepository as any,
      legacyStatusRepository,
      { saveInbound: jest.fn().mockResolvedValue(undefined) } as any,
      {
        getFieldMap: jest.fn(() => ({
          decision: 'survey_decision',
          q1: 'q1',
          q2: 'q2',
          q3: 'q3',
          q4: 'q4',
          q5Comment: 'q5_comment',
        })),
      } as any,
      new ConversationKeyFactory(),
      { record: jest.fn().mockResolvedValue(undefined) } as any,
    );

    const result = await useCase.execute({
      ...event,
      interactiveFlowToken: 'survey_dispatch:100:2026-05-11',
      interactiveFlowResponse: {
        survey_decision: '3',
      },
    });

    expect(result).toEqual({ handled: true });
    expect(surveyDispatchRepository.markBlockedContact).toHaveBeenCalled();
    expect(
      surveyDispatchRepository.upsertContactSuppression,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        reason: 'UNKNOWN_PERSON',
      }),
    );
  });
});
