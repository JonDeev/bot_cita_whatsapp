import { Injectable } from '@nestjs/common';
import { BotSurveyDispatchStatus, Prisma } from '@whatsapp-bot/prisma-client';
import { PrismaBotService } from '../../../../../shared/infrastructure/prisma-bot/prisma-bot.service';
import {
  SATISFACTION_SURVEY_DISPATCH_STATUSES,
  type CreateSurveyDispatchCommand,
  type CreateSurveyDispatchResult,
  type MarkSurveyDispatchCancelledByHandoffCommand,
  type MarkSurveyDispatchFailedCommand,
  type MarkSurveyDispatchSentCommand,
  type SatisfactionSurveyDispatchRecord,
  type SurveyDispatchAppointmentSnapshot,
  type SurveyDispatchRepository,
} from '../../../domain/ports/survey-dispatch.repository';

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

          const conflictedDispatch = await tx.botSurveyDispatch.findUniqueOrThrow({
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

  async findById(dispatchId: number): Promise<SatisfactionSurveyDispatchRecord | null> {
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

  private mapDispatch(
    dispatch: Prisma.BotSurveyDispatchGetPayload<{
      include: {
        appointments: true;
      };
    }>,
  ): SatisfactionSurveyDispatchRecord {
    return {
      id: dispatch.id,
      patientLegacyUserId: dispatch.patientLegacyUserId,
      patientName: dispatch.patientName,
      patientPhone: dispatch.patientPhone,
      patientPhoneE164: dispatch.patientPhoneE164,
      surveyDateIso: dispatch.surveyDate.toISOString().slice(0, 10),
      status: this.fromDispatchStatus(dispatch.status),
      dedupeKey: dispatch.dedupeKey,
      expiresAtIso: dispatch.expiresAt.toISOString(),
      conversationKey: dispatch.conversationKey,
      initialTemplateName: dispatch.initialTemplateName,
      initialTemplateLanguage: dispatch.initialTemplateLanguage,
      flowToken: dispatch.flowToken,
      appointments: dispatch.appointments.map((appointment): SurveyDispatchAppointmentSnapshot => ({
        legacyAgendaId: appointment.legacyAgendaId,
        appointmentDateIso: appointment.appointmentDate.toISOString().slice(0, 10),
        appointmentTimeHhmm: appointment.appointmentTimeHhmm,
        specialtyName: appointment.specialtyName,
        doctorName: appointment.doctorName,
        siteName: appointment.siteName,
      })),
    };
  }

  private fromDispatchStatus(value: BotSurveyDispatchStatus) {
    const byValue = {
      [BotSurveyDispatchStatus.PENDING]: SATISFACTION_SURVEY_DISPATCH_STATUSES.PENDING,
      [BotSurveyDispatchStatus.SENT]: SATISFACTION_SURVEY_DISPATCH_STATUSES.SENT,
      [BotSurveyDispatchStatus.STARTED]: SATISFACTION_SURVEY_DISPATCH_STATUSES.STARTED,
      [BotSurveyDispatchStatus.COMPLETED]: SATISFACTION_SURVEY_DISPATCH_STATUSES.COMPLETED,
      [BotSurveyDispatchStatus.DECLINED]: SATISFACTION_SURVEY_DISPATCH_STATUSES.DECLINED,
      [BotSurveyDispatchStatus.EXPIRED]: SATISFACTION_SURVEY_DISPATCH_STATUSES.EXPIRED,
      [BotSurveyDispatchStatus.FAILED]: SATISFACTION_SURVEY_DISPATCH_STATUSES.FAILED,
      [BotSurveyDispatchStatus.CANCELLED_BY_HANDOFF]:
        SATISFACTION_SURVEY_DISPATCH_STATUSES.CANCELLED_BY_HANDOFF,
      [BotSurveyDispatchStatus.BLOCKED_CONTACT]:
        SATISFACTION_SURVEY_DISPATCH_STATUSES.BLOCKED_CONTACT,
    } as const;

    return byValue[value];
  }

  private toDateOnly(value: string): Date {
    return new Date(`${value}T00:00:00.000Z`);
  }

  private isUniqueConstraintError(error: unknown): error is Prisma.PrismaClientKnownRequestError {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
      return false;
    }

    const prismaError = error as Prisma.PrismaClientKnownRequestError;
    return prismaError.code === 'P2002';
  }
}
