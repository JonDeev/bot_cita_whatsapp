import { AuditService } from '../../../audit/application/services/audit.service';
import { ConversationKeyFactory } from '../../../conversations/application/services/conversation-key.factory';
import { SendWhatsappTemplateMessageUseCase } from '../../../whatsapp/application/use-cases/outbound/send-whatsapp-template-message.use-case';
import { TemplateMessageSnapshotService } from '../../../whatsapp/application/services/template-message-snapshot.service';
import { WhatsappConfigService } from '../../../whatsapp/application/services/whatsapp-config.service';
import { SendSatisfactionSurveyPhoneVerificationUseCase } from './send-satisfaction-survey-phone-verification.use-case';

describe('SendSatisfactionSurveyPhoneVerificationUseCase', () => {
  it('sends the configured verification template and persists the outbound snapshot', async () => {
    const templateSnapshotService = new TemplateMessageSnapshotService();
    const surveyDispatchRepository = {
      findById: jest.fn().mockResolvedValue({
        id: 44,
        patientLegacyUserId: 91,
        patientName: 'Adriana Ruiz',
        patientPhone: '3001112233',
        patientPhoneE164: '573001112233',
        status: 'PENDING',
        verificationWhatsappMessageId: null,
      }),
      markVerificationPending: jest.fn().mockResolvedValue(undefined),
      markVerificationFailed: jest.fn().mockResolvedValue(undefined),
    };
    const conversationMessageRepository = {
      saveOutbound: jest.fn().mockResolvedValue(undefined),
    };
    const sendWhatsappTemplateMessage = {
      execute: jest.fn().mockResolvedValue({ messageId: 'wamid-template-444' }),
    } as unknown as SendWhatsappTemplateMessageUseCase;
    const actionKeyService = {
      create: jest
        .fn()
        .mockReturnValueOnce('confirm-key-1')
        .mockReturnValueOnce('reject-key-1'),
    };
    const runtimeSettingsResolver = {
      resolveStoredSnapshot: jest.fn().mockResolvedValue({
        sendMode: 'live',
        sendRolloutPercent: 100,
        emergencyPauseEnabled: false,
      }),
      isWithinSendRollout: jest.fn().mockReturnValue(true),
    };
    const whatsappConfigService = {
      getPhoneNumberId: jest.fn(() => '112260851488328'),
    } as unknown as WhatsappConfigService;
    const templateConfig = {
      getTemplateName: jest.fn(() => 'verificacion_telefono_paciente'),
      getTemplateLanguageCode: jest.fn(() => 'es_CO'),
      getConfirmButtonPayloadPrefix: jest.fn(() => 'ssv_confirm:'),
      getRejectButtonPayloadPrefix: jest.fn(() => 'ssv_reject:'),
    };
    const auditService = {
      record: jest.fn().mockResolvedValue(undefined),
    } as unknown as AuditService;
    const expectedTemplateSnapshot =
      templateSnapshotService.buildSurveyPhoneVerificationSnapshot({
        templateName: 'verificacion_telefono_paciente',
        languageCode: 'es_CO',
        bodyTextParameters: ['Adriana Ruiz'],
        visibleButtons: [
          { index: '0', title: 'Confirmar' },
          { index: '1', title: 'No lo reconozco' },
        ],
        buttonPayloads: [
          { index: '0', payload: 'ssv_confirm:confirm-key-1' },
          { index: '1', payload: 'ssv_reject:reject-key-1' },
        ],
      });

    const useCase = new SendSatisfactionSurveyPhoneVerificationUseCase(
      surveyDispatchRepository as any,
      conversationMessageRepository as any,
      sendWhatsappTemplateMessage,
      new ConversationKeyFactory(),
      whatsappConfigService,
      templateConfig as any,
      actionKeyService as any,
      runtimeSettingsResolver as any,
      templateSnapshotService,
      auditService,
    );

    const result = await useCase.execute({ dispatchId: 44 });

    expect(sendWhatsappTemplateMessage.execute).toHaveBeenCalledWith({
      to: '573001112233',
      templateName: 'verificacion_telefono_paciente',
      languageCode: 'es_CO',
      bodyTextParameters: ['Adriana Ruiz'],
      quickReplyButtons: [
        { index: '0', payload: 'ssv_confirm:confirm-key-1' },
        { index: '1', payload: 'ssv_reject:reject-key-1' },
      ],
      trigger: 'satisfaction_survey_phone_verification',
    });
    expect(conversationMessageRepository.saveOutbound).toHaveBeenCalledWith(
      expect.objectContaining({
        conversationKey: 'whatsapp:112260851488328:573001112233',
        body: expectedTemplateSnapshot.visibleBody,
        templateSnapshot: expectedTemplateSnapshot,
      }),
    );
    expect(surveyDispatchRepository.markVerificationPending).toHaveBeenCalledWith({
      dispatchId: 44,
      verificationTemplateName: 'verificacion_telefono_paciente',
      verificationTemplateLanguage: 'es_CO',
      verificationConfirmActionKey: 'confirm-key-1',
      verificationRejectActionKey: 'reject-key-1',
      verificationWhatsappMessageId: 'wamid-template-444',
      verificationRequestedAtIso: expect.any(String),
    });
    expect(result).toEqual({
      messageId: 'wamid-template-444',
      deliveryMode: 'live',
      wasSent: true,
    });
  });
});
