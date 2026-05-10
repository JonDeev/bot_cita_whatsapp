import { SurveyFlowTokenFactory } from './survey-flow-token.factory';

describe('SurveyFlowTokenFactory', () => {
  it('builds a stable token from dispatch id and survey date', () => {
    const factory = new SurveyFlowTokenFactory();

    expect(
      factory.create({
        dispatchId: 18,
        surveyDateIso: '2026-05-10',
      }),
    ).toBe('survey_dispatch:18:2026-05-10');
  });
});
