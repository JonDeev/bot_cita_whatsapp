import { BadRequestException } from '@nestjs/common';
import { AuditService } from '../../../audit/application/services/audit.service';
import { GetSatisfactionSurveyMetricsUseCase } from './get-satisfaction-survey-metrics.use-case';

describe('GetSatisfactionSurveyMetricsUseCase', () => {
  it('returns windows and totals with computed rates', async () => {
    const repository = {
      findByDateAndOptionalWindow: jest.fn().mockResolvedValue([
        {
          windowStartHHmm: '07:00',
          windowEndHHmm: '07:30',
          eligible: 20,
          sent: 18,
          failed: 2,
          completed: 8,
          declined: 3,
          blocked: 1,
        },
      ]),
    };
    const auditService = { record: jest.fn().mockResolvedValue(undefined) };

    const useCase = new GetSatisfactionSurveyMetricsUseCase(
      repository,
      auditService as unknown as AuditService,
    );

    const result = await useCase.execute({
      surveyDateIso: '2026-05-11',
    });

    expect(result.windows[0]).toMatchObject({
      sendRate: 0.9,
      completionRate: 0.4444,
    });
    expect(result.totals).toMatchObject({
      eligible: 20,
      sent: 18,
      sendRate: 0.9,
      completionRate: 0.4444,
    });
    expect(auditService.record).toHaveBeenCalledWith('survey.metrics.queried', {
      surveyDateIso: '2026-05-11',
      windowStartHHmm: null,
      windowEndHHmm: null,
      windowsCount: 1,
      totalEligible: 20,
      totalSent: 18,
    });
  });

  it('rejects incomplete window filter pair', async () => {
    const useCase = new GetSatisfactionSurveyMetricsUseCase(
      { findByDateAndOptionalWindow: jest.fn() },
      { record: jest.fn() } as any,
    );

    await expect(
      useCase.execute({
        surveyDateIso: '2026-05-11',
        windowStartHHmm: '07:30',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects non-calendar dates', async () => {
    const useCase = new GetSatisfactionSurveyMetricsUseCase(
      { findByDateAndOptionalWindow: jest.fn() },
      { record: jest.fn() } as any,
    );

    await expect(
      useCase.execute({
        surveyDateIso: '2026-02-31',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects invalid 24-hour times', async () => {
    const useCase = new GetSatisfactionSurveyMetricsUseCase(
      { findByDateAndOptionalWindow: jest.fn() },
      { record: jest.fn() } as any,
    );

    await expect(
      useCase.execute({
        surveyDateIso: '2026-05-11',
        windowStartHHmm: '24:00',
        windowEndHHmm: '24:30',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
