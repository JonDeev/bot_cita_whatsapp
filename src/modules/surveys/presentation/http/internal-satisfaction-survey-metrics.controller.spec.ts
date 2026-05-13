import { UnauthorizedException } from '@nestjs/common';
import { InternalSatisfactionSurveyMetricsController } from './internal-satisfaction-survey-metrics.controller';

describe('InternalSatisfactionSurveyMetricsController', () => {
  it('returns metrics when token is valid', async () => {
    const useCase = {
      execute: jest.fn().mockResolvedValue({
        surveyDateIso: '2026-05-11',
        timezone: 'America/Bogota',
        windows: [],
        totals: {
          eligible: 0,
          sent: 0,
          failed: 0,
          completed: 0,
          declined: 0,
          blocked: 0,
          sendRate: 0,
          completionRate: 0,
        },
      }),
    };

    const controller = new InternalSatisfactionSurveyMetricsController(
      useCase as any,
      { getInternalToken: jest.fn(() => 'secret-token') },
    );

    const result = await controller.getMetrics(
      '2026-05-11',
      undefined,
      undefined,
      'secret-token',
    );

    expect(useCase.execute).toHaveBeenCalledWith({
      surveyDateIso: '2026-05-11',
      windowStartHHmm: undefined,
      windowEndHHmm: undefined,
    });
    expect(result.surveyDateIso).toBe('2026-05-11');
  });

  it('rejects invalid internal token', async () => {
    const controller = new InternalSatisfactionSurveyMetricsController(
      { execute: jest.fn() } as any,
      { getInternalToken: jest.fn(() => 'secret-token') },
    );

    await expect(
      controller.getMetrics('2026-05-11', undefined, undefined, 'wrong-token'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('allows request when no internal token is configured', async () => {
    const useCase = {
      execute: jest.fn().mockResolvedValue({
        surveyDateIso: '2026-05-11',
        timezone: 'America/Bogota',
        windows: [],
        totals: {
          eligible: 0,
          sent: 0,
          failed: 0,
          completed: 0,
          declined: 0,
          blocked: 0,
          sendRate: 0,
          completionRate: 0,
        },
      }),
    };

    const controller = new InternalSatisfactionSurveyMetricsController(
      useCase as any,
      { getInternalToken: jest.fn(() => null) },
    );

    await controller.getMetrics('2026-05-11', '07:00', '07:30', undefined);

    expect(useCase.execute).toHaveBeenCalledWith({
      surveyDateIso: '2026-05-11',
      windowStartHHmm: '07:00',
      windowEndHHmm: '07:30',
    });
  });
});
