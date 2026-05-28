import { Injectable } from '@nestjs/common';
import { GetSatisfactionSurveyMetricsUseCase } from '../../../surveys/application/use-cases/get-satisfaction-survey-metrics.use-case';

export interface GetAdminSurveyMetricsInput {
  date?: string;
  windowStart?: string;
  windowEnd?: string;
}

@Injectable()
export class GetAdminSurveyMetricsUseCase {
  constructor(
    private readonly getMetrics: GetSatisfactionSurveyMetricsUseCase,
  ) {}

  execute(input: GetAdminSurveyMetricsInput) {
    return this.getMetrics.execute({
      surveyDateIso: input.date,
      windowStartHHmm: input.windowStart,
      windowEndHHmm: input.windowEnd,
    });
  }
}
