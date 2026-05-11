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
  SATISFACTION_SURVEY_LEGACY_NOTIFICATION_STATUSES,
  type SatisfactionSurveyLegacyStatusRepository,
} from '../../domain/ports/satisfaction-survey-legacy-status.repository';
import { SATISFACTION_SURVEY_DISPATCH_STATUSES, type SurveyDispatchRepository } from '../../domain/ports/survey-dispatch.repository';
import { SatisfactionSurveyFlowSubmissionFieldMapService } from '../services/satisfaction-survey-flow-submission-field-map.service';

const ACCEPT_VALUE = '1';
const DECLINE_VALUES = new Set(['2', '4']);
const UNKNOWN_PERSON_VALUE = '3';

export interface RecordSatisfactionSurveyFlowSubmissionResult {
  handled: boolean;
}

@Injectable()
export class RecordSatisfactionSurveyFlowSubmissionUseCase {
  constructor(
    @Inject(SURVEY_DISPATCH_REPOSITORY)
    private readonly surveyDispatchRepository: SurveyDispatchRepository,
    @Inject(SATISFACTION_SURVEY_LEGACY_STATUS_REPOSITORY)
    private readonly legacyStatusRepository: SatisfactionSurveyLegacyStatusRepository,
    @Inject(CONVERSATION_MESSAGE_REPOSITORY)
    private readonly conversationMessageRepository: ConversationMessageRepository,
    private readonly fieldMapService: SatisfactionSurveyFlowSubmissionFieldMapService,
    private readonly conversationKeyFactory: ConversationKeyFactory,
    private readonly auditService: AuditService,
  ) {}

  async execute(
    event: IncomingMessageReceivedEvent,
  ): Promise<RecordSatisfactionSurveyFlowSubmissionResult> {
    const response = event.interactiveFlowResponse;
    const flowToken = event.interactiveFlowToken?.trim() ?? '';

    if (!flowToken || !response) {
      return { handled: false };
    }

    const dispatch = await this.surveyDispatchRepository.findByFlowToken(flowToken);
    if (!dispatch) {
      await this.auditService.record('survey.flow.submission.unmatched_token', {
        flowToken,
        messageId: event.messageId,
      });
      return { handled: true };
    }

    const conversationKey = this.conversationKeyFactory.createWhatsappConversationKey(
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

    const nowIso = new Date().toISOString();
    const relatedAgendaIds = dispatch.appointments.map((appointment) => appointment.legacyAgendaId);

    if (dispatch.status === SATISFACTION_SURVEY_DISPATCH_STATUSES.SENT) {
      await this.surveyDispatchRepository.markStarted({
        dispatchId: dispatch.id,
        startedAtIso: nowIso,
      });
    }

    const map = this.fieldMapService.getFieldMap();
    const decision = this.readStringField(response, map.decision);

    if (decision === UNKNOWN_PERSON_VALUE) {
      await this.handleUnknownPerson(dispatch.id, dispatch.patientLegacyUserId, dispatch.patientPhone);
      await this.markRelatedAgendas(
        relatedAgendaIds,
        SATISFACTION_SURVEY_LEGACY_NOTIFICATION_STATUSES.NOT_APPLICABLE,
      );
      await this.auditService.record('survey.phone_suppressed', {
        dispatchId: dispatch.id,
        patientLegacyUserId: dispatch.patientLegacyUserId,
        reason: 'UNKNOWN_PERSON',
      });
      return { handled: true };
    }

    if (decision && DECLINE_VALUES.has(decision)) {
      await this.surveyDispatchRepository.markDeclined({
        dispatchId: dispatch.id,
        declinedAtIso: nowIso,
      });
      await this.markRelatedAgendas(
        relatedAgendaIds,
        SATISFACTION_SURVEY_LEGACY_NOTIFICATION_STATUSES.NOT_APPLICABLE,
      );
      await this.auditService.record('survey.declined', {
        dispatchId: dispatch.id,
        patientLegacyUserId: dispatch.patientLegacyUserId,
      });
      return { handled: true };
    }

    const q1 = this.readStringField(response, map.q1);
    const q2 = this.readStringField(response, map.q2);
    const q3 = this.readStringField(response, map.q3);
    const q4 = this.readStringField(response, map.q4);
    const q5Comment = this.readStringField(response, map.q5Comment);

    const hasStructuredAnswers = Boolean(q1 || q2 || q3 || q4 || q5Comment);
    if (!hasStructuredAnswers && decision !== ACCEPT_VALUE) {
      await this.auditService.record('survey.flow.submission.ignored_without_answers', {
        dispatchId: dispatch.id,
        flowToken,
        messageId: event.messageId,
      });
      return { handled: true };
    }

    await this.saveAnswers({
      dispatchId: dispatch.id,
      surveyDefinitionId: dispatch.surveyDefinitionId,
      messageId: event.messageId,
      nowIso,
      q1,
      q2,
      q3,
      q4,
      q5Comment,
    });

    await this.surveyDispatchRepository.markCompleted({
      dispatchId: dispatch.id,
      completedAtIso: nowIso,
    });

    await this.markRelatedAgendas(
      relatedAgendaIds,
      SATISFACTION_SURVEY_LEGACY_NOTIFICATION_STATUSES.ANSWERED,
    );

    await this.auditService.record('survey.completed', {
      dispatchId: dispatch.id,
      patientLegacyUserId: dispatch.patientLegacyUserId,
      hasComment: Boolean(q5Comment),
    });

    return { handled: true };
  }

  private async handleUnknownPerson(
    dispatchId: number,
    patientLegacyUserId: number,
    phone: string,
  ): Promise<void> {
    await this.surveyDispatchRepository.markBlockedContact({
      dispatchId,
      blockedAtIso: new Date().toISOString(),
    });

    await this.surveyDispatchRepository.upsertContactSuppression({
      patientLegacyUserId,
      phone,
      reason: 'UNKNOWN_PERSON',
      notes: 'Marked from satisfaction survey WhatsApp Flow submission.',
    });
  }

  private async saveAnswers(input: {
    dispatchId: number;
    surveyDefinitionId: number;
    messageId: string;
    nowIso: string;
    q1?: string;
    q2?: string;
    q3?: string;
    q4?: string;
    q5Comment?: string;
  }): Promise<void> {
    const answerCommands = [
      {
        questionKey: 'EASE_OF_SCHEDULING',
        answerOrder: 1,
        selectedOptionValue: input.q1,
      },
      {
        questionKey: 'OVERALL_SATISFACTION',
        answerOrder: 2,
        selectedOptionValue: input.q2,
      },
      {
        questionKey: 'WOULD_RECOMMEND',
        answerOrder: 3,
        selectedOptionValue: input.q3,
      },
      {
        questionKey: 'AREA_TO_IMPROVE',
        answerOrder: 4,
        selectedOptionValue: input.q4,
      },
      {
        questionKey: 'COMMENT',
        answerOrder: 5,
        freeTextAnswer: input.q5Comment,
      },
    ];

    for (const command of answerCommands) {
      if (!command.selectedOptionValue && !command.freeTextAnswer) {
        continue;
      }

      await this.surveyDispatchRepository.saveAnswerByQuestionKey({
        dispatchId: input.dispatchId,
        surveyDefinitionId: input.surveyDefinitionId,
        questionKey: command.questionKey,
        answerOrder: command.answerOrder,
        selectedOptionValue: command.selectedOptionValue,
        freeTextAnswer: command.freeTextAnswer,
        sourceMessageId: input.messageId,
        answeredAtIso: input.nowIso,
      });
    }
  }

  private async markRelatedAgendas(
    agendaIds: readonly number[],
    status: typeof SATISFACTION_SURVEY_LEGACY_NOTIFICATION_STATUSES[keyof typeof SATISFACTION_SURVEY_LEGACY_NOTIFICATION_STATUSES],
  ): Promise<void> {
    if (agendaIds.length === 0) {
      return;
    }

    await this.legacyStatusRepository.updateAgendaSurveyNotificationStatus({
      legacyAgendaIds: agendaIds,
      status,
    });
  }

  private readStringField(
    response: Record<string, unknown>,
    key: string,
  ): string | undefined {
    const value = response[key];
    if (typeof value !== 'string') {
      return undefined;
    }

    const normalized = value.trim();
    return normalized.length > 0 ? normalized : undefined;
  }
}
