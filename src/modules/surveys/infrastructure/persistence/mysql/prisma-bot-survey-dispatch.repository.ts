import { Injectable } from '@nestjs/common';
import {
  BotContactChannel,
  BotContactSuppressionReason,
  BotSurveyDispatchStatus,
  Prisma,
} from '@whatsapp-bot/prisma-client';
import { PrismaBotService } from '../../../../../shared/infrastructure/prisma-bot/prisma-bot.service';
import {
  SATISFACTION_SURVEY_DISPATCH_STATUSES,
  type CreateSurveyDispatchCommand,
  type CreateSurveyDispatchResult,
  type MarkSurveyDispatchCancelledByHandoffCommand,
  type MarkSurveyDispatchCompletedCommand,
  type MarkSurveyDispatchDeclinedCommand,
  type MarkSurveyDispatchFailedCommand,
  type MarkSurveyDispatchBlockedContactCommand,
  type MarkSurveyDispatchVerificationConfirmedCommand,
  type MarkSurveyDispatchVerificationFailedCommand,
  type MarkSurveyDispatchVerificationPendingCommand,
  type MarkSurveyDispatchVerificationRejectedCommand,
  type MarkSurveyDispatchStartedCommand,
  type MarkSurveyDispatchSentCommand,
  type SaveSurveyAnswerByQuestionKeyCommand,
  type SatisfactionSurveyDispatchRecord,
  type SurveyDispatchAppointmentSnapshot,
  type SurveyDispatchRepository,
  type UpsertSurveyContactSuppressionCommand,
} from '../../../domain/ports/survey-dispatch.repository';

const BOT_SURVEY_DISPATCH_STATUS_PHONE_VERIFICATION_PENDING =
  'PHONE_VERIFICATION_PENDING' as const;

@Injectable()
export class PrismaBotSurveyDispatchRepository implements SurveyDispatchRepository {
  constructor(private readonly prismaBot: PrismaBotService) {}

  async createOrGetDailyDispatch(
    command: CreateSurveyDispatchCommand,
  ): Promise<CreateSurveyDispatchResult> {
    const surveyDate = this.toDateOnly(command.surveyDateIso);
    const windowStartAt = new Date(command.windowStartIso);
    const windowEndAt = new Date(command.windowEndIso);
    const expiresAt = new Date(command.expiresAtIso);

    return this.prismaBot.$transaction(async (tx) => {
      const surveyDefinition = await tx.botSurveyDefinition.findUnique({
        where: {
          code_version: {
            code: command.surveyDefinitionCode,
            version: command.surveyDefinitionVersion,
          },
        },
        select: { id: true },
      });

      if (!surveyDefinition) {
        throw new Error(
          `Survey definition ${command.surveyDefinitionCode}@${command.surveyDefinitionVersion} was not found.`,
        );
      }

      const existingDispatch = await tx.botSurveyDispatch.findUnique({
        where: {
          patientLegacyUserId_surveyDate: {
            patientLegacyUserId: command.patientLegacyUserId,
            surveyDate,
          },
        },
        select: { id: true },
      });

      let dispatchId = existingDispatch?.id ?? null;
      let wasCreated = false;

      if (!dispatchId) {
        try {
          const createdDispatch = await tx.botSurveyDispatch.create({
            data: {
              surveyDefinitionId: surveyDefinition.id,
              patientLegacyUserId: command.patientLegacyUserId,
              patientName: command.patientName,
              patientPhone: command.patientPhone,
              patientPhoneE164: command.patientPhoneE164,
              surveyDate,
              status: BotSurveyDispatchStatus.PENDING,
              triggerType: command.triggerType,
              windowStartAt,
              windowEndAt,
              expiresAt,
              verificationTemplateName: null,
              verificationTemplateLanguage: null,
              verificationConfirmActionKey: null,
              verificationRejectActionKey: null,
              verificationWhatsappMessageId: null,
              verificationRequestedAt: null,
              verificationConfirmedAt: null,
              verificationRejectedAt: null,
              verificationFailedAt: null,
              verificationFailureReason: null,
              dedupeKey: command.dedupeKey,
            },
            select: { id: true },
          });

          dispatchId = createdDispatch.id;
          wasCreated = true;
        } catch (error) {
          if (!this.isUniqueConstraintError(error)) {
            throw error;
          }

          const conflictedDispatch =
            await tx.botSurveyDispatch.findUniqueOrThrow({
              where: {
                patientLegacyUserId_surveyDate: {
                  patientLegacyUserId: command.patientLegacyUserId,
                  surveyDate,
                },
              },
              select: { id: true },
            });

          dispatchId = conflictedDispatch.id;
        }
      }

      for (const appointment of command.appointments) {
        await tx.botSurveyDispatchAppointment.upsert({
          where: {
            legacyAgendaId: appointment.legacyAgendaId,
          },
          create: {
            surveyDispatchId: dispatchId,
            legacyAgendaId: appointment.legacyAgendaId,
            appointmentDate: this.toDateOnly(appointment.appointmentDateIso),
            appointmentTimeHhmm: appointment.appointmentTimeHhmm,
            specialtyName: appointment.specialtyName ?? null,
            doctorName: appointment.doctorName ?? null,
            siteName: appointment.siteName ?? null,
          },
          update: {
            surveyDispatchId: dispatchId,
            appointmentDate: this.toDateOnly(appointment.appointmentDateIso),
            appointmentTimeHhmm: appointment.appointmentTimeHhmm,
            specialtyName: appointment.specialtyName ?? null,
            doctorName: appointment.doctorName ?? null,
            siteName: appointment.siteName ?? null,
          },
        });
      }

      const dispatch = await tx.botSurveyDispatch.findUniqueOrThrow({
        where: { id: dispatchId },
        include: {
          appointments: {
            orderBy: [
              { appointmentDate: 'asc' },
              { appointmentTimeHhmm: 'asc' },
              { legacyAgendaId: 'asc' },
            ],
          },
        },
      });

      return {
        dispatch: this.mapDispatch(dispatch),
        wasCreated,
      };
    });
  }

  async findById(
    dispatchId: number,
  ): Promise<SatisfactionSurveyDispatchRecord | null> {
    const dispatch = await this.prismaBot.botSurveyDispatch.findUnique({
      where: { id: dispatchId },
      include: {
        appointments: {
          orderBy: [
            { appointmentDate: 'asc' },
            { appointmentTimeHhmm: 'asc' },
            { legacyAgendaId: 'asc' },
          ],
        },
      },
    });

    if (!dispatch) {
      return null;
    }

    return this.mapDispatch(dispatch);
  }

  async findByFlowToken(
    flowToken: string,
  ): Promise<SatisfactionSurveyDispatchRecord | null> {
    const normalizedToken = flowToken.trim();
    if (!normalizedToken) {
      return null;
    }

    return this.findDispatchByWhere({
      flowToken: normalizedToken,
    });
  }

  async findByInitialWhatsappMessageId(
    initialWhatsappMessageId: string,
  ): Promise<SatisfactionSurveyDispatchRecord | null> {
    const normalizedMessageId = initialWhatsappMessageId.trim();
    if (!normalizedMessageId) {
      return null;
    }

    return this.findDispatchByWhere({
      initialWhatsappMessageId: normalizedMessageId,
    });
  }

  async findByVerificationActionKey(
    verificationActionKey: string,
  ): Promise<SatisfactionSurveyDispatchRecord | null> {
    const normalizedActionKey = verificationActionKey.trim();
    if (!normalizedActionKey) {
      return null;
    }

    return this.findDispatchByWhere({
      OR: [
        { verificationConfirmActionKey: normalizedActionKey },
        { verificationRejectActionKey: normalizedActionKey },
      ],
    });
  }

  async markSent(command: MarkSurveyDispatchSentCommand): Promise<void> {
    await this.prismaBot.botSurveyDispatch.update({
      where: { id: command.dispatchId },
      data: {
        status: BotSurveyDispatchStatus.SENT,
        conversationKey: command.conversationKey,
        initialTemplateName: command.initialTemplateName,
        initialTemplateLanguage: command.initialTemplateLanguage,
        initialWhatsappMessageId: command.initialWhatsappMessageId,
        flowToken: command.flowToken,
        failedAt: null,
        failureReason: null,
      },
    });
  }

  async markVerificationPending(
    command: MarkSurveyDispatchVerificationPendingCommand,
  ): Promise<void> {
    await this.prismaBot.botSurveyDispatch.update({
      where: { id: command.dispatchId },
      data: {
        status: BOT_SURVEY_DISPATCH_STATUS_PHONE_VERIFICATION_PENDING as BotSurveyDispatchStatus,
        verificationTemplateName: command.verificationTemplateName,
        verificationTemplateLanguage: command.verificationTemplateLanguage,
        verificationConfirmActionKey: command.verificationConfirmActionKey,
        verificationRejectActionKey: command.verificationRejectActionKey,
        verificationWhatsappMessageId: command.verificationWhatsappMessageId,
        verificationRequestedAt: new Date(command.verificationRequestedAtIso),
        verificationConfirmedAt: null,
        verificationRejectedAt: null,
        verificationFailedAt: null,
        verificationFailureReason: null,
      },
    });
  }

  async markVerificationConfirmed(
    command: MarkSurveyDispatchVerificationConfirmedCommand,
  ): Promise<void> {
    await this.prismaBot.botSurveyDispatch.update({
      where: { id: command.dispatchId },
      data: {
        verificationConfirmedAt: new Date(command.verificationConfirmedAtIso),
      },
    });
  }

  async markVerificationRejected(
    command: MarkSurveyDispatchVerificationRejectedCommand,
  ): Promise<void> {
    await this.prismaBot.botSurveyDispatch.update({
      where: { id: command.dispatchId },
      data: {
        status: BotSurveyDispatchStatus.DECLINED,
        verificationRejectedAt: new Date(command.verificationRejectedAtIso),
      },
    });
  }

  async markVerificationFailed(
    command: MarkSurveyDispatchVerificationFailedCommand,
  ): Promise<void> {
    await this.prismaBot.botSurveyDispatch.update({
      where: { id: command.dispatchId },
      data: {
        status: BotSurveyDispatchStatus.FAILED,
        verificationFailedAt: new Date(command.verificationFailedAtIso),
        verificationFailureReason: command.verificationFailureReason,
      },
    });
  }

  async markFailed(command: MarkSurveyDispatchFailedCommand): Promise<void> {
    await this.prismaBot.botSurveyDispatch.update({
      where: { id: command.dispatchId },
      data: {
        status: BotSurveyDispatchStatus.FAILED,
        failedAt: new Date(command.failedAtIso),
        failureReason: command.failureReason,
      },
    });
  }

  async markCancelledByHandoff(
    command: MarkSurveyDispatchCancelledByHandoffCommand,
  ): Promise<void> {
    await this.prismaBot.botSurveyDispatch.update({
      where: { id: command.dispatchId },
      data: {
        status: BotSurveyDispatchStatus.CANCELLED_BY_HANDOFF,
        failureReason: command.cancellationReason,
      },
    });
  }

  async markStarted(command: MarkSurveyDispatchStartedCommand): Promise<void> {
    await this.prismaBot.botSurveyDispatch.update({
      where: { id: command.dispatchId },
      data: {
        status: BotSurveyDispatchStatus.STARTED,
        flowOpenedAt: new Date(command.startedAtIso),
        startedAt: new Date(command.startedAtIso),
      },
    });
  }

  async markCompleted(
    command: MarkSurveyDispatchCompletedCommand,
  ): Promise<void> {
    await this.prismaBot.botSurveyDispatch.update({
      where: { id: command.dispatchId },
      data: {
        status: BotSurveyDispatchStatus.COMPLETED,
        completedAt: new Date(command.completedAtIso),
      },
    });
  }

  async markDeclined(
    command: MarkSurveyDispatchDeclinedCommand,
  ): Promise<void> {
    await this.prismaBot.botSurveyDispatch.update({
      where: { id: command.dispatchId },
      data: {
        status: BotSurveyDispatchStatus.DECLINED,
        declinedAt: new Date(command.declinedAtIso),
      },
    });
  }

  async markBlockedContact(
    command: MarkSurveyDispatchBlockedContactCommand,
  ): Promise<void> {
    await this.prismaBot.botSurveyDispatch.update({
      where: { id: command.dispatchId },
      data: {
        status: BotSurveyDispatchStatus.BLOCKED_CONTACT,
        declinedAt: new Date(command.blockedAtIso),
      },
    });
  }

  async saveAnswerByQuestionKey(
    command: SaveSurveyAnswerByQuestionKeyCommand,
  ): Promise<void> {
    await this.prismaBot.$transaction(async (tx) => {
      const question = await tx.botSurveyQuestion.findUnique({
        where: {
          surveyDefinitionId_questionKey: {
            surveyDefinitionId: command.surveyDefinitionId,
            questionKey: command.questionKey,
          },
        },
        select: {
          id: true,
        },
      });

      if (!question) {
        throw new Error(
          `Survey question ${command.questionKey} was not found for definition ${command.surveyDefinitionId}.`,
        );
      }

      let selectedOptionLabelSnapshot: string | null = null;
      if (command.selectedOptionValue?.trim()) {
        const option = await tx.botSurveyQuestionOption.findUnique({
          where: {
            surveyQuestionId_optionValue: {
              surveyQuestionId: question.id,
              optionValue: command.selectedOptionValue.trim(),
            },
          },
          select: {
            optionLabel: true,
          },
        });

        if (option) {
          selectedOptionLabelSnapshot = option.optionLabel;
        }
      }

      await tx.botSurveyAnswer.upsert({
        where: {
          surveyDispatchId_surveyQuestionId: {
            surveyDispatchId: command.dispatchId,
            surveyQuestionId: question.id,
          },
        },
        create: {
          surveyDispatchId: command.dispatchId,
          surveyQuestionId: question.id,
          answerOrder: command.answerOrder,
          selectedOptionValue: command.selectedOptionValue?.trim() || null,
          selectedOptionLabelSnapshot,
          freeTextAnswer: command.freeTextAnswer?.trim() || null,
          sourceMessageId: command.sourceMessageId?.trim() || null,
          answeredAt: new Date(command.answeredAtIso),
        },
        update: {
          answerOrder: command.answerOrder,
          selectedOptionValue: command.selectedOptionValue?.trim() || null,
          selectedOptionLabelSnapshot,
          freeTextAnswer: command.freeTextAnswer?.trim() || null,
          sourceMessageId: command.sourceMessageId?.trim() || null,
          answeredAt: new Date(command.answeredAtIso),
        },
      });
    });
  }

  async upsertContactSuppression(
    command: UpsertSurveyContactSuppressionCommand,
  ): Promise<void> {
    const reasonByValue: Record<
      UpsertSurveyContactSuppressionCommand['reason'],
      BotContactSuppressionReason
    > = {
      UNKNOWN_PERSON: BotContactSuppressionReason.UNKNOWN_PERSON,
      OPT_OUT_SURVEY: BotContactSuppressionReason.OPT_OUT_SURVEY,
      INVALID_PHONE: BotContactSuppressionReason.INVALID_PHONE,
      MANUAL_BLOCK: BotContactSuppressionReason.MANUAL_BLOCK,
    };

    const existing = await this.prismaBot.botContactSuppression.findFirst({
      where: {
        phone: command.phone,
        channel: BotContactChannel.WHATSAPP,
        reason: reasonByValue[command.reason],
        scope: 'SURVEYS',
      },
      select: {
        id: true,
      },
    });

    if (existing) {
      await this.prismaBot.botContactSuppression.update({
        where: {
          id: existing.id,
        },
        data: {
          patientLegacyUserId: command.patientLegacyUserId,
          active: true,
          notes: command.notes?.trim() || null,
          expiresAt: null,
        },
      });
      return;
    }

    await this.prismaBot.botContactSuppression.create({
      data: {
        patientLegacyUserId: command.patientLegacyUserId,
        phone: command.phone,
        channel: BotContactChannel.WHATSAPP,
        reason: reasonByValue[command.reason],
        scope: 'SURVEYS',
        active: true,
        notes: command.notes?.trim() || null,
      },
    });
  }

  private mapDispatch(
    dispatch: Prisma.BotSurveyDispatchGetPayload<{
      include: {
        appointments: true;
      };
    }>,
  ): SatisfactionSurveyDispatchRecord {
    return {
      id: dispatch.id,
      surveyDefinitionId: dispatch.surveyDefinitionId,
      patientLegacyUserId: dispatch.patientLegacyUserId,
      patientName: dispatch.patientName,
      patientPhone: dispatch.patientPhone,
      patientPhoneE164: dispatch.patientPhoneE164,
      surveyDateIso: dispatch.surveyDate.toISOString().slice(0, 10),
      status: this.fromDispatchStatus(dispatch.status),
      dedupeKey: dispatch.dedupeKey,
      expiresAtIso: dispatch.expiresAt.toISOString(),
      verificationTemplateName: dispatch.verificationTemplateName,
      verificationTemplateLanguage: dispatch.verificationTemplateLanguage,
      verificationConfirmActionKey: dispatch.verificationConfirmActionKey,
      verificationRejectActionKey: dispatch.verificationRejectActionKey,
      verificationWhatsappMessageId: dispatch.verificationWhatsappMessageId,
      verificationRequestedAtIso:
        dispatch.verificationRequestedAt?.toISOString() ?? null,
      verificationConfirmedAtIso:
        dispatch.verificationConfirmedAt?.toISOString() ?? null,
      verificationRejectedAtIso:
        dispatch.verificationRejectedAt?.toISOString() ?? null,
      verificationFailedAtIso:
        dispatch.verificationFailedAt?.toISOString() ?? null,
      verificationFailureReason: dispatch.verificationFailureReason,
      conversationKey: dispatch.conversationKey,
      initialTemplateName: dispatch.initialTemplateName,
      initialTemplateLanguage: dispatch.initialTemplateLanguage,
      flowToken: dispatch.flowToken,
      appointments: dispatch.appointments.map(
        (appointment): SurveyDispatchAppointmentSnapshot => ({
          legacyAgendaId: appointment.legacyAgendaId,
          appointmentDateIso: appointment.appointmentDate
            .toISOString()
            .slice(0, 10),
          appointmentTimeHhmm: appointment.appointmentTimeHhmm,
          specialtyName: appointment.specialtyName,
          doctorName: appointment.doctorName,
          siteName: appointment.siteName,
        }),
      ),
    };
  }

  private async findDispatchByWhere(
    where: Prisma.BotSurveyDispatchWhereInput,
  ): Promise<SatisfactionSurveyDispatchRecord | null> {
    const dispatch = await this.prismaBot.botSurveyDispatch.findFirst({
      where,
      include: {
        appointments: {
          orderBy: [
            { appointmentDate: 'asc' },
            { appointmentTimeHhmm: 'asc' },
            { legacyAgendaId: 'asc' },
          ],
        },
      },
    });

    if (!dispatch) {
      return null;
    }

    return this.mapDispatch(dispatch);
  }

  private fromDispatchStatus(value: string) {
    const byValue = {
      [BotSurveyDispatchStatus.PENDING]:
        SATISFACTION_SURVEY_DISPATCH_STATUSES.PENDING,
      [BOT_SURVEY_DISPATCH_STATUS_PHONE_VERIFICATION_PENDING]:
        SATISFACTION_SURVEY_DISPATCH_STATUSES.PHONE_VERIFICATION_PENDING,
      [BotSurveyDispatchStatus.SENT]:
        SATISFACTION_SURVEY_DISPATCH_STATUSES.SENT,
      [BotSurveyDispatchStatus.STARTED]:
        SATISFACTION_SURVEY_DISPATCH_STATUSES.STARTED,
      [BotSurveyDispatchStatus.COMPLETED]:
        SATISFACTION_SURVEY_DISPATCH_STATUSES.COMPLETED,
      [BotSurveyDispatchStatus.DECLINED]:
        SATISFACTION_SURVEY_DISPATCH_STATUSES.DECLINED,
      [BotSurveyDispatchStatus.EXPIRED]:
        SATISFACTION_SURVEY_DISPATCH_STATUSES.EXPIRED,
      [BotSurveyDispatchStatus.FAILED]:
        SATISFACTION_SURVEY_DISPATCH_STATUSES.FAILED,
      [BotSurveyDispatchStatus.CANCELLED_BY_HANDOFF]:
        SATISFACTION_SURVEY_DISPATCH_STATUSES.CANCELLED_BY_HANDOFF,
      [BotSurveyDispatchStatus.BLOCKED_CONTACT]:
        SATISFACTION_SURVEY_DISPATCH_STATUSES.BLOCKED_CONTACT,
    } as const;

    return byValue[value as keyof typeof byValue];
  }

  private toDateOnly(value: string): Date {
    return new Date(`${value}T00:00:00.000Z`);
  }

  private isUniqueConstraintError(
    error: unknown,
  ): error is Prisma.PrismaClientKnownRequestError {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
      return false;
    }

    const prismaError = error as Prisma.PrismaClientKnownRequestError;
    return prismaError.code === 'P2002';
  }
}
