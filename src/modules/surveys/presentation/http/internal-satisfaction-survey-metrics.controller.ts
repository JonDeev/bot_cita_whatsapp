import { Controller, Get, Headers, Query, UnauthorizedException } from '@nestjs/common';
import {
  GetSatisfactionSurveyMetricsResult,
  GetSatisfactionSurveyMetricsUseCase,
} from '../../application/use-cases/get-satisfaction-survey-metrics.use-case';
import { SatisfactionSurveyMetricsAccessConfigService } from '../../application/services/satisfaction-survey-metrics-access-config.service';

@Controller('internal/surveys')
export class InternalSatisfactionSurveyMetricsController {
  constructor(
    private readonly getSatisfactionSurveyMetrics: GetSatisfactionSurveyMetricsUseCase,
    private readonly accessConfig: SatisfactionSurveyMetricsAccessConfigService,
  ) {}

  @Get('metrics')
  async getMetrics(
    @Query('date') date: string | undefined,
    @Query('windowStart') windowStart: string | undefined,
    @Query('windowEnd') windowEnd: string | undefined,
    @Headers('x-internal-token') internalToken: string | undefined,
  ): Promise<GetSatisfactionSurveyMetricsResult> {
    this.assertAuthorized(internalToken);

    return this.getSatisfactionSurveyMetrics.execute({
      surveyDateIso: date,
      windowStartHHmm: windowStart,
      windowEndHHmm: windowEnd,
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
}
