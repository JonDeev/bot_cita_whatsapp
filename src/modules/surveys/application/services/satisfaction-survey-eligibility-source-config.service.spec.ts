import {
  SatisfactionSurveyEligibilitySourceConfigService,
  SURVEY_ELIGIBILITY_SOURCES,
} from './satisfaction-survey-eligibility-source-config.service';

describe('SatisfactionSurveyEligibilitySourceConfigService', () => {
  const originalSource = process.env.SURVEYS_ELIGIBILITY_SOURCE;
  const originalPath = process.env.SURVEYS_ELIGIBILITY_JSON_FILE_PATH;

  afterEach(() => {
    process.env.SURVEYS_ELIGIBILITY_SOURCE = originalSource;
    process.env.SURVEYS_ELIGIBILITY_JSON_FILE_PATH = originalPath;
  });

  it('defaults to legacy source', () => {
    delete process.env.SURVEYS_ELIGIBILITY_SOURCE;
    const service = new SatisfactionSurveyEligibilitySourceConfigService();

    expect(service.getSource()).toBe(SURVEY_ELIGIBILITY_SOURCES.LEGACY);
  });

  it('uses json source when configured', () => {
    process.env.SURVEYS_ELIGIBILITY_SOURCE = 'json';
    const service = new SatisfactionSurveyEligibilitySourceConfigService();

    expect(service.getSource()).toBe(SURVEY_ELIGIBILITY_SOURCES.JSON);
  });

  it('returns configured json file path', () => {
    process.env.SURVEYS_ELIGIBILITY_JSON_FILE_PATH = 'tmp/custom.json';
    const service = new SatisfactionSurveyEligibilitySourceConfigService();

    expect(service.getJsonFilePath()).toBe('tmp/custom.json');
  });
});
