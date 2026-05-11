import { SatisfactionSurveyFlowSubmissionFieldMapService } from './satisfaction-survey-flow-submission-field-map.service';

describe('SatisfactionSurveyFlowSubmissionFieldMapService', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('uses default field keys when env vars are missing', () => {
    delete process.env.SURVEY_FLOW_FIELD_DECISION;

    const service = new SatisfactionSurveyFlowSubmissionFieldMapService();

    expect(service.getFieldMap()).toEqual({
      decision: 'survey_decision',
      q1: 'q1',
      q2: 'q2',
      q3: 'q3',
      q4: 'q4',
      q5Comment: 'q5_comment',
    });
  });
});
