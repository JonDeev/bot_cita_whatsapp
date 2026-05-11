import { BotSurveyDispatchStatus } from '@whatsapp-bot/prisma-client';
import { Injectable } from '@nestjs/common';
import { PrismaBotService } from '../../../../../shared/infrastructure/prisma-bot/prisma-bot.service';
import type {
  FindSatisfactionSurveyMetricsFilters,
  SatisfactionSurveyMetricsRepository,
  SatisfactionSurveyMetricsWindow,
} from '../../../domain/ports/satisfaction-survey-metrics.repository';

interface MutableWindowCounters {
  windowStartHHmm: string;
  windowEndHHmm: string;
  eligibleAgendaIds: Set<number>;
  sent: number;
  failed: number;
  completed: number;
  declined: number;
  blocked: number;
}

@Injectable()
export class PrismaBotSatisfactionSurveyMetricsRepository
  implements SatisfactionSurveyMetricsRepository
{
  constructor(private readonly prismaBot: PrismaBotService) {}

  async findByDateAndOptionalWindow(
    filters: FindSatisfactionSurveyMetricsFilters,
  ): Promise<SatisfactionSurveyMetricsWindow[]> {
    const surveyDate = new Date(`${filters.surveyDateIso}T00:00:00.000Z`);

    const where = {
      surveyDate,
      ...(filters.windowStartHHmm && filters.windowEndHHmm
        ? {
            windowStartAt: this.toBogotaDateTime(filters.surveyDateIso, filters.windowStartHHmm),
            windowEndAt: this.toBogotaDateTime(filters.surveyDateIso, filters.windowEndHHmm),
          }
        : {}),
    };

    const dispatches = await this.prismaBot.botSurveyDispatch.findMany({
      where,
      select: {
        status: true,
        windowStartAt: true,
        windowEndAt: true,
        appointments: {
          select: {
            legacyAgendaId: true,
          },
        },
      },
      orderBy: [
        { windowStartAt: 'asc' },
        { windowEndAt: 'asc' },
        { id: 'asc' },
      ],
    });

    const grouped = new Map<string, MutableWindowCounters>();

    for (const dispatch of dispatches) {
      const windowStartHHmm = this.toBogotaHHmm(dispatch.windowStartAt);
      const windowEndHHmm = this.toBogotaHHmm(dispatch.windowEndAt);
      const groupKey = `${windowStartHHmm}-${windowEndHHmm}`;

      const current = grouped.get(groupKey) ?? {
        windowStartHHmm,
        windowEndHHmm,
        eligibleAgendaIds: new Set<number>(),
        sent: 0,
        failed: 0,
        completed: 0,
        declined: 0,
        blocked: 0,
      };

      for (const appointment of dispatch.appointments) {
        current.eligibleAgendaIds.add(appointment.legacyAgendaId);
      }

      if (this.isSentStatus(dispatch.status)) {
        current.sent += 1;
      }

      if (dispatch.status === BotSurveyDispatchStatus.FAILED) {
        current.failed += 1;
      }

      if (dispatch.status === BotSurveyDispatchStatus.COMPLETED) {
        current.completed += 1;
      }

      if (dispatch.status === BotSurveyDispatchStatus.DECLINED) {
        current.declined += 1;
      }

      if (dispatch.status === BotSurveyDispatchStatus.BLOCKED_CONTACT) {
        current.blocked += 1;
      }

      grouped.set(groupKey, current);
    }

    return Array.from(grouped.values())
      .map((window): SatisfactionSurveyMetricsWindow => ({
        windowStartHHmm: window.windowStartHHmm,
        windowEndHHmm: window.windowEndHHmm,
        eligible: window.eligibleAgendaIds.size,
        sent: window.sent,
        failed: window.failed,
        completed: window.completed,
        declined: window.declined,
        blocked: window.blocked,
      }))
      .sort((left, right) => left.windowStartHHmm.localeCompare(right.windowStartHHmm));
  }

  private toBogotaDateTime(dateIso: string, hhmm: string): Date {
    return new Date(`${dateIso}T${hhmm}:00-05:00`);
  }

  private toBogotaHHmm(value: Date): string {
    const formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'America/Bogota',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });

    return formatter.format(value);
  }

  private isSentStatus(status: BotSurveyDispatchStatus): boolean {
    return (
      status === BotSurveyDispatchStatus.SENT ||
      status === BotSurveyDispatchStatus.STARTED ||
      status === BotSurveyDispatchStatus.COMPLETED ||
      status === BotSurveyDispatchStatus.DECLINED ||
      status === BotSurveyDispatchStatus.EXPIRED ||
      status === BotSurveyDispatchStatus.BLOCKED_CONTACT
    );
  }
}
