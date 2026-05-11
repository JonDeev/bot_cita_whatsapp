import { Injectable } from '@nestjs/common';

export const SURVEY_ELIGIBILITY_SOURCES = {
  LEGACY: 'legacy',
  JSON: 'json',
} as const;

export type SurveyEligibilitySource =
  (typeof SURVEY_ELIGIBILITY_SOURCES)[keyof typeof SURVEY_ELIGIBILITY_SOURCES];

@Injectable()
export class SatisfactionSurveyEligibilitySourceConfigService {
  getSource(): SurveyEligibilitySource {
    const source = (process.env.SURVEYS_ELIGIBILITY_SOURCE ?? '').trim().toLowerCase();
    if (source === SURVEY_ELIGIBILITY_SOURCES.JSON) {
      return SURVEY_ELIGIBILITY_SOURCES.JSON;
    }

    return SURVEY_ELIGIBILITY_SOURCES.LEGACY;
  }

  getJsonFilePath(): string {
    const configuredPath = (process.env.SURVEYS_ELIGIBILITY_JSON_FILE_PATH ?? '').trim();
    if (configuredPath) {
      return configuredPath;
    }

    return 'ops/fixtures/surveys/eligibility-test.json';
  }
}
