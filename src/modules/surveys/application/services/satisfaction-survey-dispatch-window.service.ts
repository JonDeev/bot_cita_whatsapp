import { Injectable } from '@nestjs/common';

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
const MINUTES_PER_HALF_HOUR = 30;
const MIN_WINDOW_END_TOTAL_MINUTES = 7 * 60 + 30;
const MAX_WINDOW_END_TOTAL_MINUTES = 17 * 60;

@Injectable()
export class SatisfactionSurveyDispatchWindowService {
  resolveForRunAt(runAt: Date): ResolveSatisfactionSurveyDispatchWindowResult {
    if (Number.isNaN(runAt.getTime())) {
      return {
        shouldRun: false,
        reason: 'Invalid runAt datetime.',
      };
    }

    const parts = this.toBogotaParts(runAt);

    if (!this.isBusinessWeekday(parts.weekday)) {
      return {
        shouldRun: false,
        reason: `Weekday ${parts.weekday} is outside Monday-Friday survey schedule.`,
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
      windowEndTotalMinutes > MAX_WINDOW_END_TOTAL_MINUTES
    ) {
      return {
        shouldRun: false,
        reason: `Time ${this.toHHmm(parts.hour, parts.minute)} is outside 07:30-17:00 dispatch window.`,
      };
    }

    const windowStartTotalMinutes =
      windowEndTotalMinutes - MINUTES_PER_HALF_HOUR;
    const windowStartHHmm = this.toHHmmFromTotalMinutes(
      windowStartTotalMinutes,
    );
    const windowEndHHmm = this.toHHmm(parts.hour, parts.minute);

    const surveyDateIso = `${parts.year}-${this.pad(parts.month)}-${this.pad(parts.day)}`;
    const windowStartIso = this.toBogotaIso(surveyDateIso, windowStartHHmm);
    const windowEndIso = this.toBogotaIso(surveyDateIso, windowEndHHmm);
    const expiresAtIso = new Date(
      new Date(windowEndIso).getTime() + 24 * 60 * 60 * 1000,
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

  private isBusinessWeekday(weekday: number): boolean {
    return weekday >= 1 && weekday <= 5;
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

  private pad(value: number): string {
    return String(value).padStart(2, '0');
  }
}
