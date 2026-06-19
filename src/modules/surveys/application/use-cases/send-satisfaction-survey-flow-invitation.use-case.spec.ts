import { BadRequestException } from '@nestjs/common';
import { AuditService } from '../../../audit/application/services/audit.service';
import { ConversationKeyFactory } from '../../../conversations/application/services/conversation-key.factory';
import { CONVERSATION_STATUSES } from '../../../conversations/domain/conversation-status';
import { SendWhatsappFlowTemplateMessageUseCase } from '../../../whatsapp/application/use-cases/outbound/send-whatsapp-flow-template-message.use-case';
import { WhatsappConfigService } from '../../../whatsapp/application/services/whatsapp-config.service';
import { SendSatisfactionSurveyFlowInvitationUseCase } from './send-satisfaction-survey-flow-invitation.use-case';

describe('SendSatisfactionSurveyFlowInvitationUseCase', () => {
  it('sends the configured flow template and persists the outbound message', async () => {
    const repository = {
      findById: jest.fn().mockResolvedValue({
        id: 22,
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
      }),
      markSent: jest.fn().mockResolvedValue(undefined),
      markFailed: jest.fn().mockResolvedValue(undefined),
      markCancelledByHandoff: jest.fn().mockResolvedValue(undefined),
    };
    const conversationMessageRepository = {
      saveOutbound: jest.fn().mockResolvedValue(undefined),
    };
    const conversationPersistenceRepository = {
      findByKey: jest.fn().mockResolvedValue(null),
    };
    const sendWhatsappFlowTemplateMessage = {
      execute: jest.fn().mockResolvedValue({ messageId: 'wamid-flow-555' }),
    } as unknown as SendWhatsappFlowTemplateMessageUseCase;
    const conversationKeyFactory = new ConversationKeyFactory();
    const whatsappConfigService = {
      getPhoneNumberId: jest.fn(() => '112260851488328'),
    } as unknown as WhatsappConfigService;
    const surveyFlowTemplateConfig = {
      getTemplateName: jest.fn(() => 'satisfaction_survey_flow'),
      getTemplateLanguageCode: jest.fn(() => 'es_CO'),
      getTemplateButtonIndex: jest.fn(() => '0'),
    };
    const surveyFlowTokenFactory = {
      create: jest.fn(() => 'survey_dispatch:22:2026-05-10'),
    };
    const runtimeSettingsResolver = {
      resolveStoredSnapshot: jest.fn().mockResolvedValue({
        sendMode: 'live',
        sendRolloutPercent: 100,
        emergencyPauseEnabled: false,
      }),
      isWithinSendRollout: jest.fn().mockReturnValue(true),
    };
    const auditService = {
      record: jest.fn().mockResolvedValue(undefined),
    } as unknown as AuditService;

    const useCase = new SendSatisfactionSurveyFlowInvitationUseCase(
      repository as any,
      conversationMessageRepository as any,
      conversationPersistenceRepository as any,
      sendWhatsappFlowTemplateMessage,
      conversationKeyFactory,
      whatsappConfigService,
      surveyFlowTemplateConfig as any,
      surveyFlowTokenFactory,
      runtimeSettingsResolver as any,
      auditService,
    );

    const result = await useCase.execute({ dispatchId: 22 });

    expect(sendWhatsappFlowTemplateMessage.execute).toHaveBeenCalledWith({
      to: '573001112233',
      templateName: 'satisfaction_survey_flow',
      languageCode: 'es_CO',
      bodyTextParameters: ['Adriana', 'MEDICINA GENERAL', '07:30'],
      buttonIndex: '0',
      flowToken: 'survey_dispatch:22:2026-05-10',
      flowActionData: {
        dispatch_id: '22',
        survey_date: '2026-05-10',
      },
      trigger: 'satisfaction_survey_dispatch',
    });
    expect(repository.markSent).toHaveBeenCalledWith({
      dispatchId: 22,
      conversationKey: 'whatsapp:112260851488328:573001112233',
      initialTemplateName: 'satisfaction_survey_flow',
      initialTemplateLanguage: 'es_CO',
      initialWhatsappMessageId: 'wamid-flow-555',
      flowToken: 'survey_dispatch:22:2026-05-10',
    });
    expect(conversationMessageRepository.saveOutbound).toHaveBeenCalled();
    expect(result).toEqual({ messageId: 'wamid-flow-555' });
  });

  it('cancels the dispatch when the conversation is in human handoff', async () => {
    const repository = {
      findById: jest.fn().mockResolvedValue({
        id: 22,
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
      }),
      markSent: jest.fn().mockResolvedValue(undefined),
      markFailed: jest.fn().mockResolvedValue(undefined),
      markCancelledByHandoff: jest.fn().mockResolvedValue(undefined),
    };
    const conversationPersistenceRepository = {
      findByKey: jest.fn().mockResolvedValue({
        status: CONVERSATION_STATUSES.HUMAN_HANDOFF,
      }),
    };
    const auditService = {
      record: jest.fn().mockResolvedValue(undefined),
    } as unknown as AuditService;
    const runtimeSettingsResolver = {
      resolveStoredSnapshot: jest.fn().mockResolvedValue({
        sendMode: 'live',
        sendRolloutPercent: 100,
        emergencyPauseEnabled: false,
      }),
      isWithinSendRollout: jest.fn().mockReturnValue(true),
    };

    const useCase = new SendSatisfactionSurveyFlowInvitationUseCase(
      repository as any,
      { saveOutbound: jest.fn() } as any,
      conversationPersistenceRepository as any,
      { execute: jest.fn() } as any,
      new ConversationKeyFactory(),
      {
        getPhoneNumberId: jest.fn(() => '112260851488328'),
      } as unknown as WhatsappConfigService,
      {
        getTemplateName: jest.fn(() => 'satisfaction_survey_flow'),
        getTemplateLanguageCode: jest.fn(() => 'es_CO'),
        getTemplateButtonIndex: jest.fn(() => '0'),
      } as any,
      { create: jest.fn(() => 'survey_dispatch:22:2026-05-10') },
      runtimeSettingsResolver as any,
      auditService,
    );

    await expect(useCase.execute({ dispatchId: 22 })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(repository.markCancelledByHandoff).toHaveBeenCalledWith({
      dispatchId: 22,
      cancellationReason: 'Conversation is in human handoff.',
    });
  });
});
