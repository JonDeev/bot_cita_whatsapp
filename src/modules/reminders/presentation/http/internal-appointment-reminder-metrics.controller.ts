import {
  BadRequestException,
  Controller,
  Get,
  Headers,
  Query,
  UnauthorizedException,
} from '@nestjs/common';
import {
  GetAppointmentReminderMetricsResult,
  GetAppointmentReminderMetricsUseCase,
} from '../../application/use-cases/get-appointment-reminder-metrics.use-case';
import { AppointmentReminderMetricsAccessConfigService } from '../../application/services/appointment-reminder-metrics-access-config.service';
import {
  APPOINTMENT_REMINDER_METRICS_LOOKBACK_ERROR_MESSAGE,
  APPOINTMENT_REMINDER_METRICS_MAX_LOOKBACK_HOURS,
  APPOINTMENT_REMINDER_METRICS_MIN_LOOKBACK_HOURS,
} from '../../domain/appointment-reminder-metrics.constants';

@Controller('internal/reminders')
export class InternalAppointmentReminderMetricsController {
  constructor(
    private readonly getAppointmentReminderMetrics: GetAppointmentReminderMetricsUseCase,
    private readonly accessConfig: AppointmentReminderMetricsAccessConfigService,
  ) {}

  @Get('metrics')
  async getMetrics(
    @Query('lookbackHours') lookbackHoursRaw: string | undefined,
    @Headers('x-internal-token') internalToken: string | undefined,
  ): Promise<GetAppointmentReminderMetricsResult> {
    this.assertAuthorized(internalToken);

    const lookbackHours = this.parseLookbackHours(lookbackHoursRaw);

    return this.getAppointmentReminderMetrics.execute({
      lookbackHours,
    });
  }

  private assertAuthorized(providedToken: string | undefined): void {
    const expectedToken = this.accessConfig.getInternalToken();
    if (!expectedToken) {
      return;
    }

    if (providedToken?.trim() !== expectedToken) {
      throw new UnauthorizedException('Invalid internal metrics token.');
    }
  }

  private parseLookbackHours(value: string | undefined): number | undefined {
    if (!value?.trim()) {
      return undefined;
    }

    const trimmed = value.trim();
    if (!/^\d+$/.test(trimmed)) {
      throw new BadRequestException(
        APPOINTMENT_REMINDER_METRICS_LOOKBACK_ERROR_MESSAGE,
      );
    }

    const parsed = Number.parseInt(trimmed, 10);
    if (
      !Number.isSafeInteger(parsed) ||
      parsed < APPOINTMENT_REMINDER_METRICS_MIN_LOOKBACK_HOURS ||
      parsed > APPOINTMENT_REMINDER_METRICS_MAX_LOOKBACK_HOURS
    ) {
      throw new BadRequestException(
        APPOINTMENT_REMINDER_METRICS_LOOKBACK_ERROR_MESSAGE,
      );
    }

    return parsed;
  }
}
