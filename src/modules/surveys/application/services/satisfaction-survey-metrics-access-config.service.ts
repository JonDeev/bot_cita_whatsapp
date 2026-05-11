import { Injectable } from '@nestjs/common';

@Injectable()
export class SatisfactionSurveyMetricsAccessConfigService {
  getInternalToken(): string | null {
    const token = (process.env.INTERNAL_SURVEYS_METRICS_TOKEN ?? '').trim();
    return token.length > 0 ? token : null;
  }
}
