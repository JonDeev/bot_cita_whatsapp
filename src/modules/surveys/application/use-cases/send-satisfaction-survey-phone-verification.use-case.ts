import { BadRequestException, Inject, Injectable, Logger } from '@nestjs/common';
import { AuditService } from '../../../audit/application/services/audit.service';
import { ConversationKeyFactory } from '../../../conversations/application/services/conversation-key.factory';
import { CONVERSATION_MESSAGE_REPOSITORY } from '../../../conversations/domain/conversations.tokens';
import type { ConversationMessageRepository } from '../../../conversations/domain/ports/conversation-message.repository';
import { SendWhatsappTemplateMessageUseCase } from '../../../whatsapp/application/use-cases/outbound/send-whatsapp-template-message.use-case';
import { WhatsappConfigService } from '../../../whatsapp/application/services/whatsapp-config.service';
import { TemplateMessageSnapshotService } from '../../../whatsapp/application/services/template-message-snapshot.service';
import type { OutboundWhatsappTemplateQuickReplyButton } from '../../../whatsapp/domain/value-objects/outbound-whatsapp-message';
import { SURVEY_DISPATCH_REPOSITORY } from '../../domain/surveys.tokens';
import {
  SATISFACTION_SURVEY_DISPATCH_STATUSES,
  type SurveyDispatchRepository,
} from '../../domain/ports/survey-dispatch.repository';
import { SatisfactionSurveyRuntimeSettingsResolverService } from '../services/satisfaction-survey-runtime-settings-resolver.service';
import { SurveyPhoneVerificationTemplateConfigService } from '../services/survey-phone-verification-template-config.service';
import { SatisfactionSurveyPhoneVerificationActionKeyService } from '../services/satisfaction-survey-phone-verification-action-key.service';

export interface SendSatisfactionSurveyPhoneVerificationInput {
  dispatchId: number;
}

export interface SendSatisfactionSurveyPhoneVerificationResult {
  messageId: string;
  deliveryMode: 'live' | 'mock';
  wasSent: boolean;
}

@Injectable()
export class SendSatisfactionSurveyPhoneVerificationUseCase {
  private readonly logger = new Logger(
    SendSatisfactionSurveyPhoneVerificationUseCase.name,
  );

  constructor(
    @Inject(SURVEY_DISPATCH_REPOSITORY)
    private readonly surveyDispatchRepository: SurveyDispatchRepository,
    @Inject(CONVERSATION_MESSAGE_REPOSITORY)
    private readonly conversationMessageRepository: ConversationMessageRepository,
    private readonly sendWhatsappTemplateMessage: SendWhatsappTemplateMessageUseCase,
    private readonly conversationKeyFactory: ConversationKeyFactory,
    private readonly whatsappConfigService: WhatsappConfigService,
    private readonly templateConfig: SurveyPhoneVerificationTemplateConfigService,
    private readonly actionKeyService: SatisfactionSurveyPhoneVerificationActionKeyService,
    private readonly runtimeSettingsResolver: SatisfactionSurveyRuntimeSettingsResolverService,
    private readonly templateSnapshotService: TemplateMessageSnapshotService,
    private readonly auditService: AuditService,
  ) {}

  async execute(
    input: SendSatisfactionSurveyPhoneVerificationInput,
  ): Promise<SendSatisfactionSurveyPhoneVerificationResult> {
    if (!Number.isInteger(input.dispatchId) || input.dispatchId <= 0) {
      throw new BadRequestException('Dispatch id must be a positive integer.');
    }

    const dispatch = await this.surveyDispatchRepository.findById(
      input.dispatchId,
    );
    if (!dispatch) {
      throw new BadRequestException(
        `Survey dispatch ${input.dispatchId} was not found.`,
      );
    }

    if (
      dispatch.status !== SATISFACTION_SURVEY_DISPATCH_STATUSES.PENDING &&
      dispatch.status !== SATISFACTION_SURVEY_DISPATCH_STATUSES.FAILED &&
      dispatch.status !==
        SATISFACTION_SURVEY_DISPATCH_STATUSES.PHONE_VERIFICATION_PENDING
    ) {
      throw new BadRequestException(
        `Survey dispatch ${dispatch.id} cannot be sent for verification from status ${dispatch.status}.`,
      );
    }

    if (
      dispatch.status ===
        SATISFACTION_SURVEY_DISPATCH_STATUSES.PHONE_VERIFICATION_PENDING &&
      dispatch.verificationWhatsappMessageId
    ) {
      return {
        messageId: dispatch.verificationWhatsappMessageId,
        deliveryMode: 'mock',
        wasSent: false,
      };
    }

    const runtimeSettings =
      await this.runtimeSettingsResolver.resolveStoredSnapshot();
    const deliveryMode = this.resolveDeliveryMode(
      dispatch.patientLegacyUserId,
      runtimeSettings.sendMode,
      runtimeSettings.sendRolloutPercent,
      runtimeSettings.emergencyPauseEnabled,
    );

    const templateName = this.templateConfig.getTemplateName();
    const templateLanguageCode = this.templateConfig.getTemplateLanguageCode();
    const patientPhone = dispatch.patientPhoneE164 ?? dispatch.patientPhone;
    const conversationKey =
      this.conversationKeyFactory.createWhatsappConversationKey(
        this.whatsappConfigService.getPhoneNumberId(),
        patientPhone,
      );

    const patientName = dispatch.patientName.trim() || 'Paciente';
    const confirmActionKey = this.actionKeyService.create();
    const rejectActionKey = this.actionKeyService.create();
    const quickReplyButtons: OutboundWhatsappTemplateQuickReplyButton[] = [
      {
        index: '0',
        payload: `${this.templateConfig.getConfirmButtonPayloadPrefix()}${confirmActionKey}`,
      },
      {
        index: '1',
        payload: `${this.templateConfig.getRejectButtonPayloadPrefix()}${rejectActionKey}`,
      },
    ];
    const sentAtIso = new Date().toISOString();
    const bodyTextParameters = [patientName];
    const templateSnapshot =
      this.templateSnapshotService.buildSurveyPhoneVerificationSnapshot({
        templateName,
        languageCode: templateLanguageCode,
        bodyTextParameters,
        visibleButtons: [
          { index: '0', title: 'Confirmar' },
          { index: '1', title: 'No lo reconozco' },
        ],
        buttonPayloads: quickReplyButtons,
      });

    await this.auditService.record(
      'survey.phone_verification.template.attempted',
      {
        dispatchId: dispatch.id,
        templateName,
        templateLanguageCode,
        conversationKey,
        sendMode: runtimeSettings.sendMode,
        rolloutPercent: runtimeSettings.sendRolloutPercent,
        emergencyPauseEnabled: runtimeSettings.emergencyPauseEnabled,
      },
    );

    try {
      const result =
        deliveryMode === 'live'
          ? await this.sendWhatsappTemplateMessage.execute({
              to: patientPhone,
              templateName,
              languageCode: templateLanguageCode,
              bodyTextParameters,
              quickReplyButtons,
              trigger: 'satisfaction_survey_phone_verification',
            })
          : { messageId: this.buildMockMessageId(dispatch.id, templateName) };

      if (deliveryMode === 'mock') {
        await this.auditService.record(
          'survey.phone_verification.template.mocked',
          {
            dispatchId: dispatch.id,
            templateName,
            templateLanguageCode,
            conversationKey,
            sendMode: runtimeSettings.sendMode,
            rolloutPercent: runtimeSettings.sendRolloutPercent,
            emergencyPauseEnabled: runtimeSettings.emergencyPauseEnabled,
          },
        );
      }

      await this.conversationMessageRepository.saveOutbound({
        conversationKey,
        messageType: 'template',
        to: patientPhone,
        whatsappMessageId: result.messageId,
        body: templateSnapshot.visibleBody,
        sentAt: sentAtIso,
        templateSnapshot,
      });

      await this.surveyDispatchRepository.markVerificationPending({
        dispatchId: dispatch.id,
        verificationTemplateName: templateName,
        verificationTemplateLanguage: templateLanguageCode,
        verificationConfirmActionKey: confirmActionKey,
        verificationRejectActionKey: rejectActionKey,
        verificationWhatsappMessageId: result.messageId,
        verificationRequestedAtIso: sentAtIso,
      });

      await this.auditService.record('survey.phone_verification.template.sent', {
        dispatchId: dispatch.id,
        templateName,
        templateLanguageCode,
        messageId: result.messageId,
        conversationKey,
        deliveryMode,
      });

      return {
        messageId: result.messageId,
        deliveryMode,
        wasSent: true,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `Failed sending survey phone verification for dispatch ${dispatch.id}.`,
        error instanceof Error ? error.stack : undefined,
      );

      await this.surveyDispatchRepository.markVerificationFailed({
        dispatchId: dispatch.id,
        verificationFailedAtIso: new Date().toISOString(),
        verificationFailureReason: errorMessage,
      });

      await this.auditService.record('survey.phone_verification.template.failed', {
        dispatchId: dispatch.id,
        templateName,
        templateLanguageCode,
        errorMessage,
      });

      throw error;
    }
  }

  private resolveDeliveryMode(
    patientLegacyUserId: number,
    sendMode: 'live' | 'mock',
    sendRolloutPercent: number,
    emergencyPauseEnabled: boolean,
  ): 'live' | 'mock' {
    if (emergencyPauseEnabled) {
      return 'mock';
    }

    if (sendMode === 'mock') {
      return 'mock';
    }

    if (
      !this.runtimeSettingsResolver.isWithinSendRollout(
        patientLegacyUserId,
        sendRolloutPercent,
      )
    ) {
      return 'mock';
    }

    return 'live';
  }

  private buildMockMessageId(
    dispatchId: number,
    templateName: string,
  ): string {
    return `mock:${dispatchId}:${templateName}`;
  }
}
