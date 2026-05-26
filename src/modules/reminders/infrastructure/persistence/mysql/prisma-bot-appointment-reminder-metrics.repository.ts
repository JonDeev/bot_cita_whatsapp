import {
  BotAppointmentReminderDispatchStatus,
  type Prisma,
} from '@whatsapp-bot/prisma-client';
import { Injectable } from '@nestjs/common';
import { PrismaBotService } from '../../../../../shared/infrastructure/prisma-bot/prisma-bot.service';
import type {
  AppointmentReminderMetricsRepository,
  AppointmentReminderOperationalMetricsSnapshot,
} from '../../../domain/ports/appointment-reminder-metrics.repository';

const SKIPPED_STATUSES: BotAppointmentReminderDispatchStatus[] = [
  BotAppointmentReminderDispatchStatus.SKIPPED_NO_OPT_IN,
  BotAppointmentReminderDispatchStatus.SKIPPED_INVALID_PHONE,
  BotAppointmentReminderDispatchStatus.SKIPPED_APPOINTMENT_CANCELLED,
  BotAppointmentReminderDispatchStatus.SKIPPED_APPOINTMENT_RESCHEDULED,
  BotAppointmentReminderDispatchStatus.SKIPPED_LATE_CONFIRMATION,
  BotAppointmentReminderDispatchStatus.SKIPPED_SUPPRESSED_CONTACT,
  BotAppointmentReminderDispatchStatus.SKIPPED_HANDOFF_ACTIVE,
];

@Injectable()
export class PrismaBotAppointmentReminderMetricsRepository implements AppointmentReminderMetricsRepository {
  constructor(private readonly prismaBot: PrismaBotService) {}

  async getOperationalSnapshot(input: {
    runAtIso: string;
    lookbackHours: number;
  }): Promise<AppointmentReminderOperationalMetricsSnapshot> {
    const runAt = new Date(input.runAtIso);
    const lookbackStart = new Date(
      runAt.getTime() - input.lookbackHours * 60 * 60 * 1000,
    );

    const dueWhere: Prisma.BotAppointmentReminderDispatchWhereInput = {
      status: {
        in: [
          BotAppointmentReminderDispatchStatus.PENDING,
          BotAppointmentReminderDispatchStatus.FAILED,
        ],
      },
      scheduledFor: {
        lte: runAt,
      },
      OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: runAt } }],
    };

    const [
      statusGroups,
      dueDispatches,
      oldestDueDispatch,
      createdRecent,
      sentRecent,
      failedRecent,
      skippedRecent,
      verificationRequestedRecent,
      sentLagRows,
      duplicateInboundIgnoredEvents,
      lockRecoveredEvents,
      lockLostEvents,
    ] = await Promise.all([
      this.prismaBot.botAppointmentReminderDispatch.groupBy({
        by: ['status'],
        _count: {
          _all: true,
        },
      }),
      this.prismaBot.botAppointmentReminderDispatch.count({
        where: dueWhere,
      }),
      this.prismaBot.botAppointmentReminderDispatch.findFirst({
        where: dueWhere,
        orderBy: [{ scheduledFor: 'asc' }, { id: 'asc' }],
        select: {
          scheduledFor: true,
        },
      }),
      this.prismaBot.botAppointmentReminderDispatch.count({
        where: {
          createdAt: {
            gte: lookbackStart,
          },
        },
      }),
      this.prismaBot.botAppointmentReminderDispatch.count({
        where: {
          sentAt: {
            gte: lookbackStart,
          },
        },
      }),
      this.prismaBot.botAppointmentReminderDispatch.count({
        where: {
          status: BotAppointmentReminderDispatchStatus.FAILED,
          updatedAt: {
            gte: lookbackStart,
          },
        },
      }),
      this.prismaBot.botAppointmentReminderDispatch.count({
        where: {
          status: {
            in: SKIPPED_STATUSES,
          },
          updatedAt: {
            gte: lookbackStart,
          },
        },
      }),
      this.prismaBot.botAppointmentReminderDispatch.count({
        where: {
          verificationRequestedAt: {
            gte: lookbackStart,
          },
        },
      }),
      this.prismaBot.botAppointmentReminderDispatch.findMany({
        where: {
          sentAt: {
            gte: lookbackStart,
          },
        },
        select: {
          scheduledFor: true,
          sentAt: true,
        },
      }),
      this.prismaBot.botAuditEvent.count({
        where: {
          action: 'appointment_reminder.inbound.duplicate_ignored',
          occurredAt: {
            gte: lookbackStart,
          },
        },
      }),
      this.prismaBot.botAuditEvent.count({
        where: {
          action: 'appointment_reminder.dispatch.lock_recovered',
          occurredAt: {
            gte: lookbackStart,
          },
        },
      }),
      this.prismaBot.botAuditEvent.count({
        where: {
          action: 'appointment_reminder.dispatch.lock_lost',
          occurredAt: {
            gte: lookbackStart,
          },
        },
      }),
    ]);

    const statusCountMap = new Map<string, number>(
      statusGroups.map((group) => [group.status, group._count._all]),
    );
    const oldestDueScheduledForIso =
      oldestDueDispatch?.scheduledFor.toISOString() ?? null;
    const maxLagSeconds = oldestDueScheduledForIso
      ? Math.max(
          0,
          Math.floor(
            (runAt.getTime() - Date.parse(oldestDueScheduledForIso)) / 1000,
          ),
        )
      : 0;

    const sendLagSeconds = sentLagRows
      .map((row) => {
        if (!row.sentAt) {
          return null;
        }

        return Math.max(
          0,
          Math.floor(
            (row.sentAt.getTime() - row.scheduledFor.getTime()) / 1000,
          ),
        );
      })
      .filter((value): value is number => value !== null);

    return {
      generatedAtIso: runAt.toISOString(),
      lookbackHours: input.lookbackHours,
      backlog: {
        dueDispatches,
        oldestDueScheduledForIso,
        maxLagSeconds,
      },
      states: {
        pending:
          statusCountMap.get(BotAppointmentReminderDispatchStatus.PENDING) ?? 0,
        locked:
          statusCountMap.get(BotAppointmentReminderDispatchStatus.LOCKED) ?? 0,
        phoneVerificationPending:
          statusCountMap.get(
            BotAppointmentReminderDispatchStatus.PHONE_VERIFICATION_PENDING,
          ) ?? 0,
        phoneVerificationExpired:
          statusCountMap.get(
            BotAppointmentReminderDispatchStatus.PHONE_VERIFICATION_EXPIRED,
          ) ?? 0,
        sent:
          statusCountMap.get(BotAppointmentReminderDispatchStatus.SENT) ?? 0,
        failed:
          statusCountMap.get(BotAppointmentReminderDispatchStatus.FAILED) ?? 0,
        skipped: SKIPPED_STATUSES.reduce(
          (current, status) => current + (statusCountMap.get(status) ?? 0),
          0,
        ),
      },
      recent: {
        created: createdRecent,
        sent: sentRecent,
        failed: failedRecent,
        skipped: skippedRecent,
        verificationRequested: verificationRequestedRecent,
        sendLatencySecondsAvg: this.computeAverage(sendLagSeconds),
        sendLatencySecondsP95Approx: this.computeP95Approx(sendLagSeconds),
      },
      reliability: {
        duplicateInboundIgnoredEvents,
        lockRecoveredEvents,
        lockLostEvents,
      },
    };
  }

  private computeAverage(values: readonly number[]): number {
    if (values.length === 0) {
      return 0;
    }

    const total = values.reduce((current, value) => current + value, 0);
    return Number((total / values.length).toFixed(2));
  }

  private computeP95Approx(values: readonly number[]): number {
    if (values.length === 0) {
      return 0;
    }

    const sorted = [...values].sort((left, right) => left - right);
    const index = Math.max(0, Math.ceil(sorted.length * 0.95) - 1);
    return sorted[index] ?? 0;
  }
}
