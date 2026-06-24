import { Inject, Injectable } from '@nestjs/common';
import { AuditService } from '../../../audit/application/services/audit.service';
import { ConversationKeyFactory } from '../../../conversations/application/services/conversation-key.factory';
import { CONVERSATION_MESSAGE_REPOSITORY } from '../../../conversations/domain/conversations.tokens';
import type { ConversationMessageRepository } from '../../../conversations/domain/ports/conversation-message.repository';
import type { IncomingMessageReceivedEvent } from '../../../whatsapp/domain/events/normalized-whatsapp.event';
import {
  SATISFACTION_SURVEY_LEGACY_STATUS_REPOSITORY,
  SURVEY_DISPATCH_REPOSITORY,
} from '../../domain/surveys.tokens';
import {
  SATISFACTION_SURVEY_DISPATCH_STATUSES,
  type SurveyDispatchRepository,
} from '../../domain/ports/survey-dispatch.repository';
import {
  SATISFACTION_SURVEY_LEGACY_NOTIFICATION_STATUSES,
  type SatisfactionSurveyLegacyStatusRepository,
} from '../../domain/ports/satisfaction-survey-legacy-status.repository';
import { RegisterWhatsappSurveyConsentUseCase } from './register-whatsapp-survey-consent.use-case';
import { SendSatisfactionSurveyFlowInvitationUseCase } from './send-satisfaction-survey-flow-invitation.use-case';
import {
  buildSatisfactionSurveyPhoneVerificationConsentText,
  SATISFACTION_SURVEY_PHONE_VERIFICATION_CONSENT_SOURCE,
} from '../services/satisfaction-survey-phone-verification-consent';
import { SatisfactionSurveyPhoneVerificationActionKeyService } from '../services/satisfaction-survey-phone-verification-action-key.service';
import { SurveyPhoneVerificationTemplateConfigService } from '../services/survey-phone-verification-template-config.service';

export interface HandleSatisfactionSurveyPhoneVerificationReplyResult {
  handled: boolean;
}

@Injectable()
export class HandleSatisfactionSurveyPhoneVerificationReplyUseCase {
  constructor(
    @Inject(SURVEY_DISPATCH_REPOSITORY)
    private readonly surveyDispatchRepository: SurveyDispatchRepository,
    @Inject(SATISFACTION_SURVEY_LEGACY_STATUS_REPOSITORY)
    private readonly legacyStatusRepository: SatisfactionSurveyLegacyStatusRepository,
    @Inject(CONVERSATION_MESSAGE_REPOSITORY)
    private readonly conversationMessageRepository: ConversationMessageRepository,
    private readonly conversationKeyFactory: ConversationKeyFactory,
    private readonly actionKeyService: SatisfactionSurveyPhoneVerificationActionKeyService,
    private readonly templateConfig: SurveyPhoneVerificationTemplateConfigService,
    private readonly registerWhatsappSurveyConsent: RegisterWhatsappSurveyConsentUseCase,
    private readonly sendSurveyFlowInvitation: SendSatisfactionSurveyFlowInvitationUseCase,
    private readonly auditService: AuditService,
  ) {}

  async execute(
    event: IncomingMessageReceivedEvent,
  ): Promise<HandleSatisfactionSurveyPhoneVerificationReplyResult> {
    if (event.kind !== 'incoming_message_received') {
      return { handled: false };
    }

    if (event.messageType !== 'interactive') {
      return { handled: false };
    }

    const matchedReply = this.classifyReply(event);
    if (!matchedReply) {
      return { handled: false };
    }

    const conversationKey =
      this.conversationKeyFactory.createWhatsappConversationKey(
        event.phoneNumberId,
        event.from,
      );

    await this.conversationMessageRepository.saveInbound({
      conversationKey,
      messageId: event.messageId,
      messageType: event.messageType,
      from: event.from,
      phoneNumberId: event.phoneNumberId ?? null,
      textBody: event.textBody ?? null,
      interactiveReplyId: event.interactiveReplyId ?? null,
      interactiveReplyTitle: event.interactiveReplyTitle ?? null,
      contextMessageId: event.contextMessageId ?? null,
      providerTimestamp: event.timestamp,
      receivedAt: event.receivedAt ?? new Date().toISOString(),
    });

    const verificationActionKey = matchedReply.verificationActionKey;
    const dispatch =
      await this.surveyDispatchRepository.findByVerificationActionKey(
        verificationActionKey,
      );
    if (
      !dispatch ||
      dispatch.status !==
        SATISFACTION_SURVEY_DISPATCH_STATUSES.PHONE_VERIFICATION_PENDING
    ) {
      await this.auditService.record(
        'survey.phone_verification.reply.invalid_dispatch',
        {
          messageId: event.messageId,
          replyType: matchedReply.type,
          replyTitle: event.interactiveReplyTitle ?? null,
        },
      );
      return { handled: true };
    }

    const expectedVerificationActionKey =
      matchedReply.type === 'CONFIRM'
        ? dispatch.verificationConfirmActionKey
        : dispatch.verificationRejectActionKey;
    if (expectedVerificationActionKey !== verificationActionKey) {
      await this.auditService.record(
        'survey.phone_verification.reply.invalid_reference',
        {
          dispatchId: dispatch.id,
          messageId: event.messageId,
          replyType: matchedReply.type,
        },
      );
      return { handled: true };
    }

    const incomingPhone = this.normalizePhone(event.from);
    const expectedPhone = this.normalizePhone(
      dispatch.patientPhoneE164 ?? dispatch.patientPhone,
    );
    if (incomingPhone !== expectedPhone) {
      await this.auditService.record(
        'survey.phone_verification.reply.phone_mismatch',
        {
          dispatchId: dispatch.id,
          messageId: event.messageId,
        },
      );
      return { handled: true };
    }

    if (
      event.contextMessageId &&
      dispatch.verificationWhatsappMessageId &&
      event.contextMessageId !== dispatch.verificationWhatsappMessageId
    ) {
      await this.auditService.record(
        'survey.phone_verification.reply.context_mismatch',
        {
          dispatchId: dispatch.id,
          messageId: event.messageId,
          contextMessageId: event.contextMessageId,
        },
      );
      return { handled: true };
    }

    if (matchedReply.type === 'REJECT') {
      await this.surveyDispatchRepository.markVerificationRejected({
        dispatchId: dispatch.id,
        verificationRejectedAtIso:
          event.receivedAt ?? new Date().toISOString(),
      });

      const relatedAgendaIds = dispatch.appointments.map(
        (appointment) => appointment.legacyAgendaId,
      );
      if (relatedAgendaIds.length > 0) {
        await this.legacyStatusRepository.updateAgendaSurveyNotificationStatus({
          legacyAgendaIds: relatedAgendaIds,
          status: SATISFACTION_SURVEY_LEGACY_NOTIFICATION_STATUSES.NOT_APPLICABLE,
        });
      }

      await this.auditService.record(
        'survey.phone_verification.rejected',
        {
          dispatchId: dispatch.id,
          patientLegacyUserId: dispatch.patientLegacyUserId,
        },
      );
      return { handled: true };
    }

    const consentResult = await this.registerWhatsappSurveyConsent.execute({
      patientId: dispatch.patientLegacyUserId,
      phone: dispatch.patientPhoneE164 ?? dispatch.patientPhone,
      granted: true,
      consentTextSnapshot: buildSatisfactionSurveyPhoneVerificationConsentText(
        dispatch.patientName,
      ),
      source: SATISFACTION_SURVEY_PHONE_VERIFICATION_CONSENT_SOURCE,
      respondedAtIso: event.receivedAt ?? new Date().toISOString(),
    });

    if (consentResult.status !== 'RECORDED') {
      await this.surveyDispatchRepository.markVerificationFailed({
        dispatchId: dispatch.id,
        verificationFailedAtIso: new Date().toISOString(),
        verificationFailureReason: `Consent record skipped: ${consentResult.reason}`,
      });
      await this.auditService.record(
        'survey.phone_verification.consent_failed',
        {
          dispatchId: dispatch.id,
          patientLegacyUserId: dispatch.patientLegacyUserId,
          reason: consentResult.reason,
        },
      );
      return { handled: true };
    }

    await this.surveyDispatchRepository.markVerificationConfirmed({
      dispatchId: dispatch.id,
      verificationConfirmedAtIso:
        event.receivedAt ?? new Date().toISOString(),
    });

    await this.sendSurveyFlowInvitation.execute({
      dispatchId: dispatch.id,
    });

    await this.auditService.record('survey.phone_verification.confirmed', {
      dispatchId: dispatch.id,
      patientLegacyUserId: dispatch.patientLegacyUserId,
      replyType: matchedReply.type,
    });

    return { handled: true };
  }

  private classifyReply(
    event: IncomingMessageReceivedEvent,
  ):
    | { type: 'CONFIRM'; verificationActionKey: string }
    | { type: 'REJECT'; verificationActionKey: string }
    | null {
    const interactiveReplyId = this.normalizePayload(event.interactiveReplyId);
    if (!interactiveReplyId) {
      return null;
    }

    const confirmPrefix = this.templateConfig.getConfirmButtonPayloadPrefix();
    if (interactiveReplyId.startsWith(confirmPrefix)) {
      const verificationActionKey = interactiveReplyId.slice(
        confirmPrefix.length,
      );
      if (!this.actionKeyService.isValid(verificationActionKey)) {
        return null;
      }

      return { type: 'CONFIRM', verificationActionKey };
    }

    const rejectPrefix = this.templateConfig.getRejectButtonPayloadPrefix();
    if (interactiveReplyId.startsWith(rejectPrefix)) {
      const verificationActionKey = interactiveReplyId.slice(
        rejectPrefix.length,
      );
      if (!this.actionKeyService.isValid(verificationActionKey)) {
        return null;
      }

      return { type: 'REJECT', verificationActionKey };
    }

    return null;
  }

  private normalizePayload(value: string | null | undefined): string | null {
    if (!value) {
      return null;
    }

    const withoutInvisibleChars = value.replace(/[\u200B-\u200D\uFEFF]/g, '');
    const normalized = withoutInvisibleChars.trim().replace(/\s+/g, ' ');

    return normalized.length > 0 ? normalized : null;
  }

  private normalizePhone(value: string): string {
    return value.replace(/\D+/g, '');
  }
}
