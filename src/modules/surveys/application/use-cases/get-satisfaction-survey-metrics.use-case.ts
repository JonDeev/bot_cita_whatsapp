import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { AuditService } from '../../../audit/application/services/audit.service';
import { SATISFACTION_SURVEY_METRICS_REPOSITORY } from '../../domain/surveys.tokens';
import type {
  SatisfactionSurveyMetricsRepository,
  SatisfactionSurveyMetricsWindow,
} from '../../domain/ports/satisfaction-survey-metrics.repository';

export interface GetSatisfactionSurveyMetricsInput {
  surveyDateIso?: string;
  windowStartHHmm?: string;
  windowEndHHmm?: string;
}

export interface SatisfactionSurveyMetricsWindowView extends SatisfactionSurveyMetricsWindow {
  sendRate: number;
  completionRate: number;
}

export interface GetSatisfactionSurveyMetricsResult {
  surveyDateIso: string;
  timezone: 'America/Bogota';
  windows: SatisfactionSurveyMetricsWindowView[];
  totals: {
    eligible: number;
    sent: number;
    failed: number;
    completed: number;
    declined: number;
    blocked: number;
    sendRate: number;
    completionRate: number;
  };
}

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const HHMM_PATTERN = /^\d{2}:\d{2}$/;

@Injectable()
export class GetSatisfactionSurveyMetricsUseCase {
  constructor(
    @Inject(SATISFACTION_SURVEY_METRICS_REPOSITORY)
    private readonly metricsRepository: SatisfactionSurveyMetricsRepository,
    private readonly auditService: AuditService,
  ) {}

  async execute(
    input: GetSatisfactionSurveyMetricsInput,
  ): Promise<GetSatisfactionSurveyMetricsResult> {
    const surveyDateIso = this.resolveSurveyDateIso(input.surveyDateIso);
    const windowStartHHmm = this.resolveOptionalHHmm(
      input.windowStartHHmm,
      'windowStartHHmm',
    );
    const windowEndHHmm = this.resolveOptionalHHmm(
      input.windowEndHHmm,
      'windowEndHHmm',
    );

    if (Boolean(windowStartHHmm) !== Boolean(windowEndHHmm)) {
      throw new BadRequestException(
        'windowStartHHmm and windowEndHHmm must be provided together.',
      );
    }

    const windows = await this.metricsRepository.findByDateAndOptionalWindow({
      surveyDateIso,
      windowStartHHmm,
      windowEndHHmm,
    });

    const windowsView = windows.map((window) => ({
      ...window,
      sendRate: this.divide(window.sent, window.eligible),
      completionRate: this.divide(window.completed, window.sent),
    }));

    const totals = windowsView.reduce(
      (current, window) => ({
        eligible: current.eligible + window.eligible,
        sent: current.sent + window.sent,
        failed: current.failed + window.failed,
        completed: current.completed + window.completed,
        declined: current.declined + window.declined,
        blocked: current.blocked + window.blocked,
      }),
      {
        eligible: 0,
        sent: 0,
        failed: 0,
        completed: 0,
        declined: 0,
        blocked: 0,
      },
    );

    const result: GetSatisfactionSurveyMetricsResult = {
      surveyDateIso,
      timezone: 'America/Bogota',
      windows: windowsView,
      totals: {
        ...totals,
        sendRate: this.divide(totals.sent, totals.eligible),
        completionRate: this.divide(totals.completed, totals.sent),
      },
    };

    await this.auditService.record('survey.metrics.queried', {
      surveyDateIso,
      windowStartHHmm: windowStartHHmm ?? null,
      windowEndHHmm: windowEndHHmm ?? null,
      windowsCount: result.windows.length,
      totalEligible: result.totals.eligible,
      totalSent: result.totals.sent,
    });

    return result;
  }

  private resolveSurveyDateIso(value: string | undefined): string {
    if (!value?.trim()) {
      return this.resolveBogotaTodayIso();
    }

    const dateIso = value.trim();
    if (!ISO_DATE_PATTERN.test(dateIso)) {
      throw new BadRequestException(
        'surveyDateIso must use YYYY-MM-DD format.',
      );
    }

    if (!this.isValidIsoDate(dateIso)) {
      throw new BadRequestException(
        'surveyDateIso must be a valid calendar date.',
      );
    }

    return dateIso;
  }

  private resolveOptionalHHmm(
    value: string | undefined,
    fieldName: string,
  ): string | undefined {
    if (!value?.trim()) {
      return undefined;
    }

    const hhmm = value.trim();
    if (!HHMM_PATTERN.test(hhmm)) {
      throw new BadRequestException(`${fieldName} must use HH:MM format.`);
    }

    if (!this.isValidHHmm(hhmm)) {
      throw new BadRequestException(
        `${fieldName} must be a valid 24-hour time.`,
      );
    }

    return hhmm;
  }

  private resolveBogotaTodayIso(): string {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Bogota',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });

    return formatter.format(new Date());
  }

  private divide(numerator: number, denominator: number): number {
    if (denominator <= 0) {
      return 0;
    }

    return Number((numerator / denominator).toFixed(4));
  }

  private isValidIsoDate(value: string): boolean {
    const [yearText, monthText, dayText] = value.split('-');
    const year = Number(yearText);
    const month = Number(monthText);
    const day = Number(dayText);
    const utcDate = new Date(Date.UTC(year, month - 1, day));

    return (
      utcDate.getUTCFullYear() === year &&
      utcDate.getUTCMonth() === month - 1 &&
      utcDate.getUTCDate() === day
    );
  }

  private isValidHHmm(value: string): boolean {
    const [hoursText, minutesText] = value.split(':');
    const hours = Number(hoursText);
    const minutes = Number(minutesText);

    return (
      Number.isInteger(hours) &&
      Number.isInteger(minutes) &&
      hours >= 0 &&
      hours <= 23 &&
      minutes >= 0 &&
      minutes <= 59
    );
  }
}
