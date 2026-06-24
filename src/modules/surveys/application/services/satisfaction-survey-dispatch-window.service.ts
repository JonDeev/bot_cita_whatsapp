import { Injectable } from '@nestjs/common';
import type { SurveyRuntimeScheduleProfile } from '@whatsapp-bot/shared';

export interface SatisfactionSurveyDispatchWindow {
  surveyDateIso: string;
  windowStartHHmm: string;
  windowEndHHmm: string;
  windowStartIso: string;
  windowEndIso: string;
  expiresAtIso: string;
}

export interface ResolveSatisfactionSurveyDispatchWindowResult {
  shouldRun: boolean;
  reason?: string;
  window?: SatisfactionSurveyDispatchWindow;
}

const EXECUTION_MINUTES = new Set([0, 30]);
const EARLIEST_DISPATCH_START_TOTAL_MINUTES = 7 * 60;
const MIN_WINDOW_END_TOTAL_MINUTES = 7 * 60 + 30;
const PROFILE_RULES: Record<
  SurveyRuntimeScheduleProfile,
  { lastWeekday: number; maxEndTotalMinutes: number }
> = {
  business_hours_mon_fri: {
    lastWeekday: 5,
    maxEndTotalMinutes: 17 * 60,
  },
  extended_hours_mon_fri: {
    lastWeekday: 5,
    maxEndTotalMinutes: 19 * 60,
  },
  business_hours_mon_sat: {
    lastWeekday: 6,
    maxEndTotalMinutes: 17 * 60,
  },
};

@Injectable()
export class SatisfactionSurveyDispatchWindowService {
  resolveForRunAt(
    runAt: Date,
    scheduleProfile: SurveyRuntimeScheduleProfile,
    expirationHours: number,
  ): ResolveSatisfactionSurveyDispatchWindowResult {
    if (Number.isNaN(runAt.getTime())) {
      return {
        shouldRun: false,
        reason: 'Invalid runAt datetime.',
      };
    }

    const scheduleRule = PROFILE_RULES[scheduleProfile];
    if (!scheduleRule) {
      return {
        shouldRun: false,
        reason: `Unsupported survey schedule profile ${scheduleProfile}.`,
      };
    }

    const parts = this.toBogotaParts(runAt);

    if (!this.isAllowedWeekday(parts.weekday, scheduleRule.lastWeekday)) {
      return {
        shouldRun: false,
        reason: `Weekday ${parts.weekday} is outside the configured survey schedule.`,
      };
    }

    if (!EXECUTION_MINUTES.has(parts.minute)) {
      return {
        shouldRun: false,
        reason: `Minute ${parts.minute} is outside half-hour execution schedule.`,
      };
    }

    const windowEndTotalMinutes = parts.hour * 60 + parts.minute;
    if (
      windowEndTotalMinutes < MIN_WINDOW_END_TOTAL_MINUTES ||
      windowEndTotalMinutes > scheduleRule.maxEndTotalMinutes
    ) {
      return {
        shouldRun: false,
        reason: `Time ${this.toHHmm(parts.hour, parts.minute)} is outside the configured survey dispatch window.`,
      };
    }

    // Surveys scan the day cumulatively from 07:00 so late-atended appointments
    // still get picked up on subsequent ticks.
    const windowStartHHmm = this.toHHmmFromTotalMinutes(
      EARLIEST_DISPATCH_START_TOTAL_MINUTES,
    );
    const windowEndHHmm = this.toHHmm(parts.hour, parts.minute);

    const surveyDateIso = `${parts.year}-${this.pad(parts.month)}-${this.pad(parts.day)}`;
    const windowStartIso = this.toBogotaIso(surveyDateIso, windowStartHHmm);
    const windowEndIso = this.toBogotaIso(surveyDateIso, windowEndHHmm);
    const expiresAtIso = new Date(
      new Date(windowEndIso).getTime() + this.toExpirationMilliseconds(expirationHours),
    ).toISOString();

    return {
      shouldRun: true,
      window: {
        surveyDateIso,
        windowStartHHmm,
        windowEndHHmm,
        windowStartIso,
        windowEndIso,
        expiresAtIso,
      },
    };
  }

  private toBogotaParts(value: Date): {
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
    weekday: number;
  } {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Bogota',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      weekday: 'short',
    });

    const parts = formatter.formatToParts(value);
    const byType = Object.fromEntries(
      parts.map((part) => [part.type, part.value]),
    );

    return {
      year: Number(byType.year),
      month: Number(byType.month),
      day: Number(byType.day),
      hour: Number(byType.hour),
      minute: Number(byType.minute),
      weekday: this.mapWeekday(byType.weekday),
    };
  }

  private mapWeekday(weekdayLabel: string | undefined): number {
    const byLabel: Record<string, number> = {
      Mon: 1,
      Tue: 2,
      Wed: 3,
      Thu: 4,
      Fri: 5,
      Sat: 6,
      Sun: 7,
    };

    return byLabel[weekdayLabel ?? ''] ?? 0;
  }

  private isAllowedWeekday(weekday: number, lastWeekday: number): boolean {
    return weekday >= 1 && weekday <= lastWeekday;
  }

  private toHHmmFromTotalMinutes(value: number): string {
    const hour = Math.floor(value / 60);
    const minute = value % 60;
    return this.toHHmm(hour, minute);
  }

  private toHHmm(hour: number, minute: number): string {
    return `${this.pad(hour)}:${this.pad(minute)}`;
  }

  private toBogotaIso(dateIso: string, hhmm: string): string {
    return new Date(`${dateIso}T${hhmm}:00-05:00`).toISOString();
  }

  private toExpirationMilliseconds(expirationHours: number): number {
    if (!Number.isFinite(expirationHours) || expirationHours <= 0) {
      return 24 * 60 * 60 * 1000;
    }

    return expirationHours * 60 * 60 * 1000;
  }

  private pad(value: number): string {
    return String(value).padStart(2, '0');
  }
}
