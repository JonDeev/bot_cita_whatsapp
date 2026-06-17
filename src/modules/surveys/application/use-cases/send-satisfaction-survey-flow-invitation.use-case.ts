import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { AuditService } from '../../../audit/application/services/audit.service';
import {
  CONVERSATION_MESSAGE_REPOSITORY,
  CONVERSATION_PERSISTENCE_REPOSITORY,
} from '../../../conversations/domain/conversations.tokens';
import { CONVERSATION_STATUSES } from '../../../conversations/domain/conversation-status';
import type { ConversationMessageRepository } from '../../../conversations/domain/ports/conversation-message.repository';
import type { ConversationPersistenceRepository } from '../../../conversations/domain/ports/conversation-persistence.repository';
import { ConversationKeyFactory } from '../../../conversations/application/services/conversation-key.factory';
import { SendWhatsappFlowTemplateMessageUseCase } from '../../../whatsapp/application/use-cases/outbound/send-whatsapp-flow-template-message.use-case';
import { WhatsappConfigService } from '../../../whatsapp/application/services/whatsapp-config.service';
import {
  SATISFACTION_SURVEY_DISPATCH_STATUSES,
  type SurveyDispatchRepository,
} from '../../domain/ports/survey-dispatch.repository';
import { SURVEY_DISPATCH_REPOSITORY } from '../../domain/surveys.tokens';
import { SurveyFlowTemplateConfigService } from '../services/survey-flow-template-config.service';
import { SatisfactionSurveyRuntimeSettingsResolverService } from '../services/satisfaction-survey-runtime-settings-resolver.service';
import { SurveyFlowTokenFactory } from '../services/survey-flow-token.factory';

export interface SendSatisfactionSurveyFlowInvitationInput {
  dispatchId: number;
}

@Injectable()
export class SendSatisfactionSurveyFlowInvitationUseCase {
  constructor(
    @Inject(SURVEY_DISPATCH_REPOSITORY)
    private readonly surveyDispatchRepository: SurveyDispatchRepository,
    @Inject(CONVERSATION_MESSAGE_REPOSITORY)
    private readonly conversationMessageRepository: ConversationMessageRepository,
    @Inject(CONVERSATION_PERSISTENCE_REPOSITORY)
    private readonly conversationPersistenceRepository: ConversationPersistenceRepository,
    private readonly sendWhatsappFlowTemplateMessage: SendWhatsappFlowTemplateMessageUseCase,
    private readonly conversationKeyFactory: ConversationKeyFactory,
    private readonly whatsappConfigService: WhatsappConfigService,
    private readonly surveyFlowTemplateConfig: SurveyFlowTemplateConfigService,
    private readonly surveyFlowTokenFactory: SurveyFlowTokenFactory,
    private readonly runtimeSettingsResolver: SatisfactionSurveyRuntimeSettingsResolverService,
    private readonly auditService: AuditService,
  ) {}

  async execute(
    input: SendSatisfactionSurveyFlowInvitationInput,
  ): Promise<{ messageId: string }> {
    if (!Number.isInteger(input.dispatchId) || input.dispatchId <= 0) {
      throw new BadRequestException('Dispatch id must be a positive integer.');
    }

    const dispatch = await this.surveyDispatchRepository.findById(
      input.dispatchId,
    );
    if (!dispatch) {
      throw new NotFoundException(
        `Survey dispatch ${input.dispatchId} was not found.`,
      );
    }

    if (
      dispatch.status !== SATISFACTION_SURVEY_DISPATCH_STATUSES.PENDING &&
      dispatch.status !== SATISFACTION_SURVEY_DISPATCH_STATUSES.FAILED
    ) {
      throw new BadRequestException(
        `Survey dispatch ${dispatch.id} cannot be sent from status ${dispatch.status}.`,
      );
    }

    const templateName = this.surveyFlowTemplateConfig.getTemplateName();
    if (!templateName) {
      throw new InternalServerErrorException(
        'Missing WHATSAPP_SURVEY_FLOW_TEMPLATE_NAME environment variable.',
      );
    }

    const templateLanguageCode =
      this.surveyFlowTemplateConfig.getTemplateLanguageCode();
    const buttonIndex = this.surveyFlowTemplateConfig.getTemplateButtonIndex();
    const runtimeSettings =
      await this.runtimeSettingsResolver.resolveStoredSnapshot();
    const deliveryMode = this.resolveDeliveryMode(
      dispatch.patientLegacyUserId,
      runtimeSettings.sendMode,
      runtimeSettings.sendRolloutPercent,
      runtimeSettings.emergencyPauseEnabled,
    );
    const flowToken =
      dispatch.flowToken ??
      this.surveyFlowTokenFactory.create({
        dispatchId: dispatch.id,
        surveyDateIso: dispatch.surveyDateIso,
      });

    const recipientPhone = dispatch.patientPhoneE164 ?? dispatch.patientPhone;
    const conversationKey =
      this.conversationKeyFactory.createWhatsappConversationKey(
        this.whatsappConfigService.getPhoneNumberId(),
        recipientPhone,
      );

    const existingConversation =
      await this.conversationPersistenceRepository.findByKey(conversationKey);
    if (existingConversation?.status === CONVERSATION_STATUSES.HUMAN_HANDOFF) {
      await this.surveyDispatchRepository.markCancelledByHandoff({
        dispatchId: dispatch.id,
        cancellationReason: 'Conversation is in human handoff.',
      });

      await this.auditService.record('survey.cancelled.human_handoff', {
        dispatchId: dispatch.id,
        conversationKey,
      });

      throw new BadRequestException(
        `Survey dispatch ${dispatch.id} cannot be sent while the conversation is in human handoff.`,
      );
    }

    const primaryAppointment = dispatch.appointments[0];
    const specialtyName =
      primaryAppointment?.specialtyName?.trim() || 'la especialidad asignada';
    const appointmentHour =
      primaryAppointment?.appointmentTimeHhmm || 'la hora asignada';

    await this.auditService.record('survey.dispatch.flow_template.attempted', {
      dispatchId: dispatch.id,
      templateName,
      templateLanguageCode,
      conversationKey,
    });

    try {
      const result =
        deliveryMode === 'live'
          ? await this.sendWhatsappFlowTemplateMessage.execute({
              to: recipientPhone,
              templateName,
              languageCode: templateLanguageCode,
              bodyTextParameters: [
                dispatch.patientName,
                specialtyName,
                appointmentHour,
              ],
              buttonIndex,
              flowToken,
              flowActionData: {
                dispatch_id: String(dispatch.id),
                survey_date: dispatch.surveyDateIso,
              },
              trigger: 'satisfaction_survey_dispatch',
            })
          : { messageId: this.buildMockMessageId(dispatch.id, templateName) };

      if (deliveryMode === 'mock') {
        await this.auditService.record('survey.dispatch.flow_template.mocked', {
          dispatchId: dispatch.id,
          templateName,
          templateLanguageCode,
          conversationKey,
          sendMode: runtimeSettings.sendMode,
          rolloutPercent: runtimeSettings.sendRolloutPercent,
          emergencyPauseEnabled: runtimeSettings.emergencyPauseEnabled,
        });
      }

      const sentAtIso = new Date().toISOString();

      await this.conversationMessageRepository.saveOutbound({
        conversationKey,
        messageType: 'template',
        to: recipientPhone,
        whatsappMessageId: result.messageId,
        body: `template:${templateName}`,
        sentAt: sentAtIso,
      });

      await this.surveyDispatchRepository.markSent({
        dispatchId: dispatch.id,
        conversationKey,
        initialTemplateName: templateName,
        initialTemplateLanguage: templateLanguageCode,
        initialWhatsappMessageId: result.messageId,
        flowToken,
      });

      await this.auditService.record('survey.dispatch.flow_template.sent', {
        dispatchId: dispatch.id,
        templateName,
        templateLanguageCode,
        messageId: result.messageId,
        conversationKey,
      });

      return { messageId: result.messageId };
    } catch (error) {
      await this.surveyDispatchRepository.markFailed({
        dispatchId: dispatch.id,
        failedAtIso: new Date().toISOString(),
        failureReason: error instanceof Error ? error.message : 'Unknown error',
      });

      await this.auditService.record('survey.dispatch.flow_template.failed', {
        dispatchId: dispatch.id,
        templateName,
        templateLanguageCode,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
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
