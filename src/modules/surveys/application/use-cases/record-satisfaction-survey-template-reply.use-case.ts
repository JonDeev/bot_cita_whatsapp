import { Inject, Injectable } from '@nestjs/common';
import { AuditService } from '../../../audit/application/services/audit.service';
import { ConversationKeyFactory } from '../../../conversations/application/services/conversation-key.factory';
import { CONVERSATION_MESSAGE_REPOSITORY } from '../../../conversations/domain/conversations.tokens';
import type { ConversationMessageRepository } from '../../../conversations/domain/ports/conversation-message.repository';
import {
  SATISFACTION_SURVEY_LEGACY_STATUS_REPOSITORY,
  SURVEY_DISPATCH_REPOSITORY,
} from '../../domain/surveys.tokens';
import {
  SATISFACTION_SURVEY_LEGACY_NOTIFICATION_STATUSES,
  type SatisfactionSurveyLegacyStatusRepository,
} from '../../domain/ports/satisfaction-survey-legacy-status.repository';
import {
  type SurveyDispatchRepository,
} from '../../domain/ports/survey-dispatch.repository';
import type { IncomingMessageReceivedEvent } from '../../../whatsapp/domain/events/normalized-whatsapp.event';

const DECLINE_REPLY_ALIASES = new Set([
  'no deseo responder',
  'no responder la encuesta',
]);

const UNKNOWN_PERSON_REPLY_ALIASES = new Set([
  'no conozco al paciente',
  'no conozco a la persona',
]);

export interface RecordSatisfactionSurveyTemplateReplyResult {
  handled: boolean;
}

@Injectable()
export class RecordSatisfactionSurveyTemplateReplyUseCase {
  constructor(
    @Inject(SURVEY_DISPATCH_REPOSITORY)
    private readonly surveyDispatchRepository: SurveyDispatchRepository,
    @Inject(SATISFACTION_SURVEY_LEGACY_STATUS_REPOSITORY)
    private readonly legacyStatusRepository: SatisfactionSurveyLegacyStatusRepository,
    @Inject(CONVERSATION_MESSAGE_REPOSITORY)
    private readonly conversationMessageRepository: ConversationMessageRepository,
    private readonly conversationKeyFactory: ConversationKeyFactory,
    private readonly auditService: AuditService,
  ) {}

  async execute(
    event: IncomingMessageReceivedEvent,
  ): Promise<RecordSatisfactionSurveyTemplateReplyResult> {
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

    const contextMessageId = event.contextMessageId?.trim() ?? '';
    if (!contextMessageId) {
      await this.auditService.record(
        'survey.template.quick_reply.recognized_without_context',
        {
          messageId: event.messageId,
          replyType: matchedReply.type,
          replyTitle: event.interactiveReplyTitle ?? null,
        },
      );
      return { handled: true };
    }

    const dispatch =
      await this.surveyDispatchRepository.findByInitialWhatsappMessageId(
        contextMessageId,
      );

    if (!dispatch) {
      await this.auditService.record('survey.template.quick_reply.unmatched', {
        messageId: event.messageId,
        contextMessageId,
        replyType: matchedReply.type,
        replyTitle: event.interactiveReplyTitle ?? null,
      });
      return { handled: true };
    }

    const nowIso = new Date().toISOString();
    const relatedAgendaIds = dispatch.appointments.map(
      (appointment) => appointment.legacyAgendaId,
    );

    if (matchedReply.type === 'UNKNOWN_PERSON') {
      await this.surveyDispatchRepository.markBlockedContact({
        dispatchId: dispatch.id,
        blockedAtIso: nowIso,
      });

      await this.surveyDispatchRepository.upsertContactSuppression({
        patientLegacyUserId: dispatch.patientLegacyUserId,
        phone: dispatch.patientPhone,
        reason: 'UNKNOWN_PERSON',
        notes: 'Marked from satisfaction survey template quick reply.',
      });
    } else {
      await this.surveyDispatchRepository.markDeclined({
        dispatchId: dispatch.id,
        declinedAtIso: nowIso,
      });
    }

    if (relatedAgendaIds.length > 0) {
      await this.legacyStatusRepository.updateAgendaSurveyNotificationStatus({
        legacyAgendaIds: relatedAgendaIds,
        status: SATISFACTION_SURVEY_LEGACY_NOTIFICATION_STATUSES.NOT_APPLICABLE,
      });
    }

    await this.auditService.record('survey.template.quick_reply.handled', {
      dispatchId: dispatch.id,
      patientLegacyUserId: dispatch.patientLegacyUserId,
      replyType: matchedReply.type,
      replyTitle: event.interactiveReplyTitle ?? null,
    });

    return { handled: true };
  }

  private classifyReply(event: IncomingMessageReceivedEvent):
    | { type: 'DECLINE' }
    | { type: 'UNKNOWN_PERSON' }
    | null {
    const interactiveReplyId = this.normalizeToken(event.interactiveReplyId);
    const interactiveReplyTitle = this.normalizeToken(event.interactiveReplyTitle);

    if (
      this.matchesAny(interactiveReplyId, DECLINE_REPLY_ALIASES) ||
      this.matchesAny(interactiveReplyTitle, DECLINE_REPLY_ALIASES)
    ) {
      return { type: 'DECLINE' };
    }

    if (
      this.matchesAny(interactiveReplyId, UNKNOWN_PERSON_REPLY_ALIASES) ||
      this.matchesAny(interactiveReplyTitle, UNKNOWN_PERSON_REPLY_ALIASES)
    ) {
      return { type: 'UNKNOWN_PERSON' };
    }

    return null;
  }

  private matchesAny(value: string | null, aliases: Set<string>): boolean {
    if (!value) {
      return false;
    }

    return aliases.has(value);
  }

  private normalizeToken(value: string | null | undefined): string | null {
    if (!value) {
      return null;
    }

    const withoutInvisibleChars = value.replace(/[\u200B-\u200D\uFEFF]/g, '');
    const normalized = withoutInvisibleChars
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim()
      .replace(/\s+/g, ' ');

    return normalized.length > 0 ? normalized : null;
  }
}
