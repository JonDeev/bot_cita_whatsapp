import { AuditService } from '../../../audit/application/services/audit.service';
import { ConversationKeyFactory } from '../../../conversations/application/services/conversation-key.factory';
import { SATISFACTION_SURVEY_LEGACY_NOTIFICATION_STATUSES } from '../../domain/ports/satisfaction-survey-legacy-status.repository';
import { RecordSatisfactionSurveyTemplateReplyUseCase } from './record-satisfaction-survey-template-reply.use-case';

describe('RecordSatisfactionSurveyTemplateReplyUseCase', () => {
  it('marks dispatch declined when the patient rejects the survey from the template button', async () => {
    const surveyDispatchRepository = {
      findByInitialWhatsappMessageId: jest.fn().mockResolvedValue({
        id: 101,
        surveyDefinitionId: 1,
        patientLegacyUserId: 77,
        patientName: 'Paciente Prueba',
        patientPhone: '3001112233',
        patientPhoneE164: '573001112233',
        surveyDateIso: '2026-05-11',
        status: 'SENT',
        dedupeKey: 'survey:77:2026-05-11',
        expiresAtIso: '2026-05-12T07:30:00.000Z',
        conversationKey: 'whatsapp:123:573001112233',
        initialTemplateName: 'satisfaction_survey_flow',
        initialTemplateLanguage: 'es_CO',
        flowToken: 'survey_dispatch:101:2026-05-11',
        appointments: [{ legacyAgendaId: 601 }],
      }),
      markDeclined: jest.fn().mockResolvedValue(undefined),
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

    const useCase = new RecordSatisfactionSurveyTemplateReplyUseCase(
      surveyDispatchRepository as any,
      legacyStatusRepository as any,
      conversationMessageRepository as any,
      new ConversationKeyFactory(),
      auditService,
    );

    const result = await useCase.execute({
      kind: 'incoming_message_received',
      messageId: 'wamid-template-reply-1',
      from: '573001112233',
      timestamp: '1711111111',
      messageType: 'interactive',
      interactiveReplyId: 'No deseo responder',
      interactiveReplyTitle: 'No deseo responder',
      contextMessageId: 'wamid-template-123',
      phoneNumberId: '123',
    });

    expect(result).toEqual({ handled: true });
    expect(conversationMessageRepository.saveInbound).toHaveBeenCalledTimes(1);
    expect(surveyDispatchRepository.findByInitialWhatsappMessageId).toHaveBeenCalledWith(
      'wamid-template-123',
    );
    expect(surveyDispatchRepository.markDeclined).toHaveBeenCalledWith(
      expect.objectContaining({
        dispatchId: 101,
      }),
    );
    expect(
      legacyStatusRepository.updateAgendaSurveyNotificationStatus,
    ).toHaveBeenCalledWith({
      legacyAgendaIds: [601],
      status: SATISFACTION_SURVEY_LEGACY_NOTIFICATION_STATUSES.NOT_APPLICABLE,
    });
    expect(auditService.record).toHaveBeenCalledWith(
      'survey.template.quick_reply.handled',
      expect.objectContaining({
        dispatchId: 101,
        replyType: 'DECLINE',
      }),
    );
  });

  it('blocks contact when the patient reports an unknown number from the template button', async () => {
    const surveyDispatchRepository = {
      findByInitialWhatsappMessageId: jest.fn().mockResolvedValue({
        id: 202,
        surveyDefinitionId: 1,
        patientLegacyUserId: 88,
        patientName: 'Paciente Prueba',
        patientPhone: '3002223344',
        patientPhoneE164: null,
        surveyDateIso: '2026-05-11',
        status: 'SENT',
        dedupeKey: 'survey:88:2026-05-11',
        expiresAtIso: '2026-05-12T07:30:00.000Z',
        conversationKey: 'whatsapp:123:573001112233',
        initialTemplateName: 'satisfaction_survey_flow',
        initialTemplateLanguage: 'es_CO',
        flowToken: 'survey_dispatch:202:2026-05-11',
        appointments: [{ legacyAgendaId: 701 }],
      }),
      markBlockedContact: jest.fn().mockResolvedValue(undefined),
      upsertContactSuppression: jest.fn().mockResolvedValue(undefined),
    };

    const legacyStatusRepository = {
      updateAgendaSurveyNotificationStatus: jest.fn().mockResolvedValue(1),
    };

    const useCase = new RecordSatisfactionSurveyTemplateReplyUseCase(
      surveyDispatchRepository as any,
      legacyStatusRepository as any,
      { saveInbound: jest.fn().mockResolvedValue(undefined) } as any,
      new ConversationKeyFactory(),
      { record: jest.fn().mockResolvedValue(undefined) } as any,
    );

    const result = await useCase.execute({
      kind: 'incoming_message_received',
      messageId: 'wamid-template-reply-2',
      from: '573001112233',
      timestamp: '1711111112',
      messageType: 'interactive',
      interactiveReplyId: 'No conozco al paciente',
      interactiveReplyTitle: 'No conozco al paciente',
      contextMessageId: 'wamid-template-456',
      phoneNumberId: '123',
    });

    expect(result).toEqual({ handled: true });
    expect(surveyDispatchRepository.markBlockedContact).toHaveBeenCalledWith(
      expect.objectContaining({
        dispatchId: 202,
      }),
    );
    expect(
      surveyDispatchRepository.upsertContactSuppression,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        patientLegacyUserId: 88,
        reason: 'UNKNOWN_PERSON',
      }),
    );
    expect(
      legacyStatusRepository.updateAgendaSurveyNotificationStatus,
    ).toHaveBeenCalledWith({
      legacyAgendaIds: [701],
      status: SATISFACTION_SURVEY_LEGACY_NOTIFICATION_STATUSES.NOT_APPLICABLE,
    });
  });
});
