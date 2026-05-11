import { SatisfactionSurveyDispatchWindowService } from './satisfaction-survey-dispatch-window.service';

describe('SatisfactionSurveyDispatchWindowService', () => {
  const service = new SatisfactionSurveyDispatchWindowService();

  it('returns the 07:00-07:30 window for a valid weekday 07:30 run', () => {
    const runAt = new Date('2026-05-11T12:30:00.000Z');

    const result = service.resolveForRunAt(runAt);

    expect(result.shouldRun).toBe(true);
    expect(result.window).toMatchObject({
      surveyDateIso: '2026-05-11',
      windowStartHHmm: '07:00',
      windowEndHHmm: '07:30',
    });
  });

  it('skips weekends', () => {
    const runAt = new Date('2026-05-10T12:30:00.000Z');

    const result = service.resolveForRunAt(runAt);

    expect(result.shouldRun).toBe(false);
    expect(result.reason).toContain('Monday-Friday');
  });
});
