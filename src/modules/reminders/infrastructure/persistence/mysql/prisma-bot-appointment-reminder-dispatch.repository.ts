import { Injectable } from '@nestjs/common';
import {
  BotAppointmentReminderDispatchStatus,
  Prisma,
} from '@whatsapp-bot/prisma-client';
import { PrismaBotService } from '../../../../../shared/infrastructure/prisma-bot/prisma-bot.service';
import type {
  AppointmentReminderDispatchRecord,
  AppointmentReminderDispatchRepository,
  ClaimDueAppointmentReminderDispatchesCommand,
  MarkDispatchFailedCommand,
  MarkDispatchSentCommand,
  MarkDispatchSkippedCommand,
  MarkDispatchVerificationPendingCommand,
  RecordInboundDedupCommand,
  RenewDispatchLockCommand,
  UpsertAppointmentReminderDispatchCommand,
} from '../../../domain/ports/appointment-reminder-dispatch.repository';

const RETRYABLE_STATUSES: BotAppointmentReminderDispatchStatus[] = [
  BotAppointmentReminderDispatchStatus.PENDING,
  BotAppointmentReminderDispatchStatus.FAILED,
];

@Injectable()
export class PrismaBotAppointmentReminderDispatchRepository implements AppointmentReminderDispatchRepository {
  constructor(private readonly prismaBot: PrismaBotService) {}

  async upsertDispatch(
    command: UpsertAppointmentReminderDispatchCommand,
  ): Promise<{
    dispatch: AppointmentReminderDispatchRecord;
    wasCreated: boolean;
  }> {
    const appointmentStartsAt = new Date(command.appointmentStartsAtIso);
    const scheduledFor = new Date(command.scheduledForIso);

    const existing =
      await this.prismaBot.botAppointmentReminderDispatch.findUnique({
        where: {
          legacyAgendaId_reminderType_appointmentStartsAt: {
            legacyAgendaId: command.legacyAgendaId,
            reminderType: command.reminderType,
            appointmentStartsAt,
          },
        },
      });

    let wasCreated = false;

    if (!existing) {
      try {
        await this.prismaBot.botAppointmentReminderDispatch.create({
          data: {
            legacyAgendaId: command.legacyAgendaId,
            patientLegacyUserId: command.patientLegacyUserId,
            conversationKey: command.conversationKey,
            recipientPhoneRaw: command.recipientPhoneRaw,
            recipientPhoneE164: command.recipientPhoneE164,
            appointmentStartsAt,
            scheduledFor,
            reminderType: command.reminderType,
            templateName: command.templateName,
            verificationTemplateName: command.verificationTemplateName,
            status: BotAppointmentReminderDispatchStatus.PENDING,
            attempts: 0,
            nextAttemptAt: null,
            lockAcquiredAt: null,
            lockExpiresAt: null,
            lockedBy: null,
            lastError: null,
          },
        });
        wasCreated = true;
      } catch (error) {
        if (!this.isUniqueConstraintError(error)) {
          throw error;
        }
      }
    }

    const dispatch =
      await this.prismaBot.botAppointmentReminderDispatch.findUniqueOrThrow({
        where: {
          legacyAgendaId_reminderType_appointmentStartsAt: {
            legacyAgendaId: command.legacyAgendaId,
            reminderType: command.reminderType,
            appointmentStartsAt,
          },
        },
      });

    if (!wasCreated) {
      await this.prismaBot.botAppointmentReminderDispatch.update({
        where: { id: dispatch.id },
        data: {
          patientLegacyUserId: command.patientLegacyUserId,
          conversationKey: command.conversationKey,
          recipientPhoneRaw: command.recipientPhoneRaw,
          recipientPhoneE164: command.recipientPhoneE164,
          appointmentStartsAt,
          scheduledFor,
          templateName: command.templateName,
          verificationTemplateName: command.verificationTemplateName,
        },
      });
    }

    const refreshed =
      await this.prismaBot.botAppointmentReminderDispatch.findUniqueOrThrow({
        where: { id: dispatch.id },
      });

    return {
      dispatch: this.mapDispatch(refreshed),
      wasCreated,
    };
  }

  async markOlderPendingDispatchesAsRescheduled(input: {
    legacyAgendaId: number;
    keepDispatchId: number;
  }): Promise<number> {
    const result =
      await this.prismaBot.botAppointmentReminderDispatch.updateMany({
        where: {
          legacyAgendaId: input.legacyAgendaId,
          id: { not: input.keepDispatchId },
          status: {
            in: [
              BotAppointmentReminderDispatchStatus.PENDING,
              BotAppointmentReminderDispatchStatus.LOCKED,
              BotAppointmentReminderDispatchStatus.PHONE_VERIFICATION_PENDING,
              BotAppointmentReminderDispatchStatus.PAUSED_HOLD,
            ],
          },
        },
        data: {
          status:
            BotAppointmentReminderDispatchStatus.SKIPPED_APPOINTMENT_RESCHEDULED,
          lockAcquiredAt: null,
          lockExpiresAt: null,
          lockedBy: null,
        },
      });

    return result.count;
  }

  async claimDueDispatches(
    command: ClaimDueAppointmentReminderDispatchesCommand,
  ): Promise<AppointmentReminderDispatchRecord[]> {
    const runAt = new Date(command.runAtIso);
    const lockExpiresAt = new Date(
      runAt.getTime() + command.lockTtlSeconds * 1000,
    );

    const candidates =
      await this.prismaBot.botAppointmentReminderDispatch.findMany({
        where: {
          ...(command.restrictToDispatchIds &&
          command.restrictToDispatchIds.length > 0
            ? {
                id: { in: [...command.restrictToDispatchIds] },
              }
            : {}),
          status: {
            in: RETRYABLE_STATUSES,
          },
          scheduledFor: {
            lte: runAt,
          },
          OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: runAt } }],
        },
        orderBy: [{ scheduledFor: 'asc' }, { id: 'asc' }],
        take: command.limit,
        select: {
          id: true,
        },
      });

    if (candidates.length === 0) {
      return [];
    }

    const candidateIds = candidates.map((candidate) => candidate.id);

    await this.prismaBot.botAppointmentReminderDispatch.updateMany({
      where: {
        id: { in: candidateIds },
        status: {
          in: RETRYABLE_STATUSES,
        },
      },
      data: {
        status: BotAppointmentReminderDispatchStatus.LOCKED,
        lockAcquiredAt: runAt,
        lockExpiresAt,
        lockedBy: command.workerId,
        lockVersion: {
          increment: 1,
        },
      },
    });

    const locked = await this.prismaBot.botAppointmentReminderDispatch.findMany(
      {
        where: {
          id: { in: candidateIds },
          status: BotAppointmentReminderDispatchStatus.LOCKED,
          lockedBy: command.workerId,
        },
        orderBy: [{ scheduledFor: 'asc' }, { id: 'asc' }],
      },
    );

    return locked.map((item) => this.mapDispatch(item));
  }

  async findDueDispatchIds(input: {
    runAtIso: string;
    limit: number;
  }): Promise<number[]> {
    const runAt = new Date(input.runAtIso);
    const rows = await this.prismaBot.botAppointmentReminderDispatch.findMany({
      where: {
        status: {
          in: RETRYABLE_STATUSES,
        },
        scheduledFor: {
          lte: runAt,
        },
        OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: runAt } }],
      },
      orderBy: [{ scheduledFor: 'asc' }, { id: 'asc' }],
      take: input.limit,
      select: {
        id: true,
      },
    });

    return rows.map((row) => row.id);
  }

  async renewLock(command: RenewDispatchLockCommand): Promise<boolean> {
    const now = new Date(command.nowIso);
    const lockExpiresAt = new Date(
      now.getTime() + command.lockTtlSeconds * 1000,
    );

    const result =
      await this.prismaBot.botAppointmentReminderDispatch.updateMany({
        where: {
          id: command.dispatchId,
          status: BotAppointmentReminderDispatchStatus.LOCKED,
          lockedBy: command.workerId,
          lockVersion: command.expectedLockVersion,
        },
        data: {
          lockAcquiredAt: now,
          lockExpiresAt,
        },
      });

    return result.count > 0;
  }

  async recoverExpiredLocks(input: {
    runAtIso: string;
    limit: number;
  }): Promise<number> {
    const runAt = new Date(input.runAtIso);
    const expired =
      await this.prismaBot.botAppointmentReminderDispatch.findMany({
        where: {
          status: BotAppointmentReminderDispatchStatus.LOCKED,
          lockExpiresAt: {
            lte: runAt,
          },
        },
        orderBy: [{ lockExpiresAt: 'asc' }, { id: 'asc' }],
        take: input.limit,
        select: {
          id: true,
        },
      });

    if (expired.length === 0) {
      return 0;
    }

    const result =
      await this.prismaBot.botAppointmentReminderDispatch.updateMany({
        where: {
          id: {
            in: expired.map((item) => item.id),
          },
          status: BotAppointmentReminderDispatchStatus.LOCKED,
          lockExpiresAt: {
            lte: runAt,
          },
        },
        data: {
          status: BotAppointmentReminderDispatchStatus.PENDING,
          lockAcquiredAt: null,
          lockExpiresAt: null,
          lockedBy: null,
          lockVersion: {
            increment: 1,
          },
        },
      });

    return result.count;
  }

  async expirePendingPhoneVerifications(input: {
    runAtIso: string;
    limit: number;
  }): Promise<number> {
    const runAt = new Date(input.runAtIso);
    const dueToExpire =
      await this.prismaBot.botAppointmentReminderDispatch.findMany({
        where: {
          status:
            BotAppointmentReminderDispatchStatus.PHONE_VERIFICATION_PENDING,
          verificationExpiresAt: {
            lte: runAt,
          },
        },
        take: input.limit,
        orderBy: [{ verificationExpiresAt: 'asc' }, { id: 'asc' }],
        select: {
          id: true,
        },
      });

    if (dueToExpire.length === 0) {
      return 0;
    }

    const result =
      await this.prismaBot.botAppointmentReminderDispatch.updateMany({
        where: {
          id: {
            in: dueToExpire.map((item) => item.id),
          },
          status:
            BotAppointmentReminderDispatchStatus.PHONE_VERIFICATION_PENDING,
        },
        data: {
          status:
            BotAppointmentReminderDispatchStatus.PHONE_VERIFICATION_EXPIRED,
          lockAcquiredAt: null,
          lockExpiresAt: null,
          lockedBy: null,
        },
      });

    return result.count;
  }

  async markVerificationPending(
    command: MarkDispatchVerificationPendingCommand,
  ): Promise<boolean> {
    const result =
      await this.prismaBot.botAppointmentReminderDispatch.updateMany({
        where: {
          id: command.dispatchId,
          status: BotAppointmentReminderDispatchStatus.LOCKED,
          lockedBy: command.workerId,
          lockVersion: command.expectedLockVersion,
        },
        data: {
          status:
            BotAppointmentReminderDispatchStatus.PHONE_VERIFICATION_PENDING,
          verificationTokenHash: command.verificationTokenHash,
          verificationMessageId: command.verificationMessageId,
          verificationRequestedAt: new Date(command.verificationRequestedAtIso),
          verificationExpiresAt: new Date(command.verificationExpiresAtIso),
          lockAcquiredAt: null,
          lockExpiresAt: null,
          lockedBy: null,
        },
      });

    return result.count > 0;
  }

  async markVerificationPendingAfterUncertainOwnership(input: {
    dispatchId: number;
    verificationTokenHash: string;
    verificationMessageId: string;
    verificationRequestedAtIso: string;
    verificationExpiresAtIso: string;
  }): Promise<boolean> {
    const result =
      await this.prismaBot.botAppointmentReminderDispatch.updateMany({
        where: {
          id: input.dispatchId,
          status: {
            in: [
              BotAppointmentReminderDispatchStatus.PENDING,
              BotAppointmentReminderDispatchStatus.FAILED,
              BotAppointmentReminderDispatchStatus.LOCKED,
            ],
          },
          verificationMessageId: null,
        },
        data: {
          status:
            BotAppointmentReminderDispatchStatus.PHONE_VERIFICATION_PENDING,
          verificationTokenHash: input.verificationTokenHash,
          verificationMessageId: input.verificationMessageId,
          verificationRequestedAt: new Date(input.verificationRequestedAtIso),
          verificationExpiresAt: new Date(input.verificationExpiresAtIso),
          lockAcquiredAt: null,
          lockExpiresAt: null,
          lockedBy: null,
        },
      });

    return result.count > 0;
  }

  async markSent(command: MarkDispatchSentCommand): Promise<boolean> {
    const result =
      await this.prismaBot.botAppointmentReminderDispatch.updateMany({
        where: {
          id: command.dispatchId,
          status: BotAppointmentReminderDispatchStatus.LOCKED,
          lockedBy: command.workerId,
          lockVersion: command.expectedLockVersion,
        },
        data: {
          status: BotAppointmentReminderDispatchStatus.SENT,
          metaMessageId: command.metaMessageId,
          sentAt: new Date(command.sentAtIso),
          lastError: null,
          nextAttemptAt: null,
          lockAcquiredAt: null,
          lockExpiresAt: null,
          lockedBy: null,
        },
      });

    return result.count > 0;
  }

  async markSentAfterUncertainOwnership(input: {
    dispatchId: number;
    metaMessageId: string;
    sentAtIso: string;
  }): Promise<boolean> {
    const result =
      await this.prismaBot.botAppointmentReminderDispatch.updateMany({
        where: {
          id: input.dispatchId,
          status: {
            in: [
              BotAppointmentReminderDispatchStatus.PENDING,
              BotAppointmentReminderDispatchStatus.FAILED,
              BotAppointmentReminderDispatchStatus.LOCKED,
            ],
          },
          sentAt: null,
        },
        data: {
          status: BotAppointmentReminderDispatchStatus.SENT,
          metaMessageId: input.metaMessageId,
          sentAt: new Date(input.sentAtIso),
          lastError: null,
          nextAttemptAt: null,
          lockAcquiredAt: null,
          lockExpiresAt: null,
          lockedBy: null,
        },
      });

    return result.count > 0;
  }

  async markSkipped(command: MarkDispatchSkippedCommand): Promise<boolean> {
    const nextStatus =
      command.status === 'PHONE_VERIFICATION_EXPIRED'
        ? BotAppointmentReminderDispatchStatus.PHONE_VERIFICATION_EXPIRED
        : (command.status as BotAppointmentReminderDispatchStatus);

    const result =
      await this.prismaBot.botAppointmentReminderDispatch.updateMany({
        where: {
          id: command.dispatchId,
          status: BotAppointmentReminderDispatchStatus.LOCKED,
          lockedBy: command.workerId,
          lockVersion: command.expectedLockVersion,
        },
        data: {
          status: nextStatus,
          lastError: command.reason ?? null,
          lockAcquiredAt: null,
          lockExpiresAt: null,
          lockedBy: null,
        },
      });

    return result.count > 0;
  }

  async markFailed(command: MarkDispatchFailedCommand): Promise<boolean> {
    const nextStatus =
      command.nextAttemptAtIso === null
        ? BotAppointmentReminderDispatchStatus.FAILED
        : BotAppointmentReminderDispatchStatus.PENDING;

    const result =
      await this.prismaBot.botAppointmentReminderDispatch.updateMany({
        where: {
          id: command.dispatchId,
          status: BotAppointmentReminderDispatchStatus.LOCKED,
          lockedBy: command.workerId,
          lockVersion: command.expectedLockVersion,
        },
        data: {
          status: nextStatus,
          attempts: command.attempts,
          nextAttemptAt: command.nextAttemptAtIso
            ? new Date(command.nextAttemptAtIso)
            : null,
          lastError: command.reason,
          lockAcquiredAt: null,
          lockExpiresAt: null,
          lockedBy: null,
        },
      });

    return result.count > 0;
  }

  async markPausedHold(command: {
    dispatchId: number;
    expectedLockVersion: number;
    workerId: string;
    reason: string;
  }): Promise<boolean> {
    const result =
      await this.prismaBot.botAppointmentReminderDispatch.updateMany({
        where: {
          id: command.dispatchId,
          status: BotAppointmentReminderDispatchStatus.LOCKED,
          lockedBy: command.workerId,
          lockVersion: command.expectedLockVersion,
        },
        data: {
          status: BotAppointmentReminderDispatchStatus.PAUSED_HOLD,
          lastError: command.reason,
          lockAcquiredAt: null,
          lockExpiresAt: null,
          lockedBy: null,
        },
      });

    return result.count > 0;
  }

  async markPostVerificationSent(input: {
    dispatchId: number;
    metaMessageId: string;
    sentAtIso: string;
  }): Promise<boolean> {
    const result =
      await this.prismaBot.botAppointmentReminderDispatch.updateMany({
        where: {
          id: input.dispatchId,
          status:
            BotAppointmentReminderDispatchStatus.PHONE_VERIFICATION_PENDING,
        },
        data: {
          status: BotAppointmentReminderDispatchStatus.SENT,
          metaMessageId: input.metaMessageId,
          sentAt: new Date(input.sentAtIso),
          lastError: null,
        },
      });

    return result.count > 0;
  }

  async markPostVerificationPausedHold(input: {
    dispatchId: number;
    reason?: string;
  }): Promise<boolean> {
    const result =
      await this.prismaBot.botAppointmentReminderDispatch.updateMany({
        where: {
          id: input.dispatchId,
          status:
            BotAppointmentReminderDispatchStatus.PHONE_VERIFICATION_PENDING,
        },
        data: {
          status: BotAppointmentReminderDispatchStatus.PAUSED_HOLD,
          lastError: input.reason ?? null,
        },
      });

    return result.count > 0;
  }

  async markPostVerificationSentAfterUncertainOwnership(input: {
    dispatchId: number;
    metaMessageId: string;
    sentAtIso: string;
  }): Promise<boolean> {
    const result =
      await this.prismaBot.botAppointmentReminderDispatch.updateMany({
        where: {
          id: input.dispatchId,
          status: {
            in: [
              BotAppointmentReminderDispatchStatus.PHONE_VERIFICATION_PENDING,
              BotAppointmentReminderDispatchStatus.PENDING,
              BotAppointmentReminderDispatchStatus.LOCKED,
              BotAppointmentReminderDispatchStatus.SENT,
            ],
          },
        },
        data: {
          status: BotAppointmentReminderDispatchStatus.SENT,
          metaMessageId: input.metaMessageId,
          sentAt: new Date(input.sentAtIso),
          lastError: null,
        },
      });

    return result.count > 0;
  }

  async markPostVerificationSkipped(input: {
    dispatchId: number;
    status:
      | 'SKIPPED_LATE_CONFIRMATION'
      | 'SKIPPED_SUPPRESSED_CONTACT'
      | 'SKIPPED_APPOINTMENT_CANCELLED'
      | 'SKIPPED_HANDOFF_ACTIVE'
      | 'SKIPPED_NO_OPT_IN';
    reason?: string;
  }): Promise<boolean> {
    const result =
      await this.prismaBot.botAppointmentReminderDispatch.updateMany({
        where: {
          id: input.dispatchId,
          status:
            BotAppointmentReminderDispatchStatus.PHONE_VERIFICATION_PENDING,
        },
        data: {
          status:
            input.status === 'SKIPPED_LATE_CONFIRMATION'
              ? BotAppointmentReminderDispatchStatus.SKIPPED_LATE_CONFIRMATION
              : input.status === 'SKIPPED_SUPPRESSED_CONTACT'
                ? BotAppointmentReminderDispatchStatus.SKIPPED_SUPPRESSED_CONTACT
                : input.status === 'SKIPPED_APPOINTMENT_CANCELLED'
                  ? BotAppointmentReminderDispatchStatus.SKIPPED_APPOINTMENT_CANCELLED
                  : input.status === 'SKIPPED_HANDOFF_ACTIVE'
                    ? BotAppointmentReminderDispatchStatus.SKIPPED_HANDOFF_ACTIVE
                    : BotAppointmentReminderDispatchStatus.SKIPPED_NO_OPT_IN,
          lastError: input.reason ?? null,
        },
      });

    return result.count > 0;
  }

  async findByVerificationTokenHash(
    verificationTokenHash: string,
  ): Promise<AppointmentReminderDispatchRecord | null> {
    const dispatch =
      await this.prismaBot.botAppointmentReminderDispatch.findFirst({
        where: {
          verificationTokenHash,
        },
      });

    return dispatch ? this.mapDispatch(dispatch) : null;
  }

  async findById(
    dispatchId: number,
  ): Promise<AppointmentReminderDispatchRecord | null> {
    const dispatch =
      await this.prismaBot.botAppointmentReminderDispatch.findUnique({
        where: { id: dispatchId },
      });

    return dispatch ? this.mapDispatch(dispatch) : null;
  }

  async recordInboundDedup(
    command: RecordInboundDedupCommand,
  ): Promise<boolean> {
    try {
      await this.prismaBot.botWebhookInboundDedup.create({
        data: {
          provider: command.provider,
          inboundMessageId: command.inboundMessageId,
          buttonPayloadId: command.buttonPayloadId,
          receivedAt: new Date(command.receivedAtIso),
          resultStatus: command.resultStatus,
        },
      });

      return true;
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        return false;
      }

      throw error;
    }
  }

  async markInboundDedupProcessed(input: {
    provider: string;
    inboundMessageId: string;
    buttonPayloadId: string;
    processedAtIso: string;
    resultStatus: string;
  }): Promise<void> {
    await this.prismaBot.botWebhookInboundDedup.updateMany({
      where: {
        provider: input.provider,
        inboundMessageId: input.inboundMessageId,
        buttonPayloadId: input.buttonPayloadId,
      },
      data: {
        processedAt: new Date(input.processedAtIso),
        resultStatus: input.resultStatus,
      },
    });
  }

  async releasePausedHolds(input: {
    runAtIso: string;
    limit: number;
  }): Promise<number[]> {
    const rows = await this.prismaBot.botAppointmentReminderDispatch.findMany({
      where: {
        status: BotAppointmentReminderDispatchStatus.PAUSED_HOLD,
        scheduledFor: {
          lte: new Date(input.runAtIso),
        },
      },
      orderBy: [{ scheduledFor: 'asc' }, { id: 'asc' }],
      take: input.limit,
      select: {
        id: true,
      },
    });

    if (rows.length === 0) {
      return [];
    }

    await this.prismaBot.botAppointmentReminderDispatch.updateMany({
      where: {
        id: {
          in: rows.map((row) => row.id),
        },
        status: BotAppointmentReminderDispatchStatus.PAUSED_HOLD,
      },
      data: {
        status: BotAppointmentReminderDispatchStatus.PENDING,
        lastError: null,
        nextAttemptAt: null,
      },
    });

    return rows.map((row) => row.id);
  }

  private mapDispatch(
    row: Prisma.BotAppointmentReminderDispatchGetPayload<Record<string, never>>,
  ): AppointmentReminderDispatchRecord {
    return {
      id: row.id,
      legacyAgendaId: row.legacyAgendaId,
      patientLegacyUserId: row.patientLegacyUserId,
      conversationKey: row.conversationKey,
      recipientPhoneRaw: row.recipientPhoneRaw,
      recipientPhoneE164: row.recipientPhoneE164,
      appointmentStartsAtIso: row.appointmentStartsAt.toISOString(),
      scheduledForIso: row.scheduledFor.toISOString(),
      reminderType: row.reminderType,
      status: row.status,
      templateName: row.templateName,
      verificationTemplateName: row.verificationTemplateName,
      metaMessageId: row.metaMessageId,
      verificationMessageId: row.verificationMessageId,
      attempts: row.attempts,
      nextAttemptAtIso: row.nextAttemptAt?.toISOString() ?? null,
      lockAcquiredAtIso: row.lockAcquiredAt?.toISOString() ?? null,
      lockExpiresAtIso: row.lockExpiresAt?.toISOString() ?? null,
      lockedBy: row.lockedBy,
      lockVersion: row.lockVersion,
      verificationTokenHash: row.verificationTokenHash,
      verificationRequestedAtIso:
        row.verificationRequestedAt?.toISOString() ?? null,
      verificationExpiresAtIso:
        row.verificationExpiresAt?.toISOString() ?? null,
      sentAtIso: row.sentAt?.toISOString() ?? null,
    };
  }

  private isUniqueConstraintError(error: unknown): boolean {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
      return false;
    }

    return error.code === 'P2002';
  }
}
