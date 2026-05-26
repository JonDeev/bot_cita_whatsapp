import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { InternalAppointmentReminderMetricsController } from './internal-appointment-reminder-metrics.controller';

describe('InternalAppointmentReminderMetricsController', () => {
  it('returns metrics when token is valid', async () => {
    const useCase = {
      execute: jest.fn().mockResolvedValue({
        generatedAtIso: '2026-05-26T10:00:00.000Z',
        timezone: 'America/Bogota',
      }),
    };

    const controller = new InternalAppointmentReminderMetricsController(
      useCase as never,
      { getInternalToken: jest.fn(() => 'secret-token') },
    );

    const result = await controller.getMetrics('24', 'secret-token');

    expect(useCase.execute).toHaveBeenCalledWith({
      lookbackHours: 24,
    });
    expect(result.timezone).toBe('America/Bogota');
  });

  it('rejects invalid internal token', async () => {
    const controller = new InternalAppointmentReminderMetricsController(
      { execute: jest.fn() } as never,
      { getInternalToken: jest.fn(() => 'secret-token') },
    );

    await expect(
      controller.getMetrics('24', 'wrong-token'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('allows request when no token is configured', async () => {
    const useCase = {
      execute: jest.fn().mockResolvedValue({
        generatedAtIso: '2026-05-26T10:00:00.000Z',
        timezone: 'America/Bogota',
      }),
    };

    const controller = new InternalAppointmentReminderMetricsController(
      useCase as never,
      { getInternalToken: jest.fn(() => null) },
    );

    await controller.getMetrics(undefined, undefined);

    expect(useCase.execute).toHaveBeenCalledWith({
      lookbackHours: undefined,
    });
  });

  it('rejects invalid lookbackHours format', async () => {
    const useCase = {
      execute: jest.fn(),
    };
    const controller = new InternalAppointmentReminderMetricsController(
      useCase as never,
      { getInternalToken: jest.fn(() => null) },
    );

    await expect(
      controller.getMetrics('2.5', undefined),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(useCase.execute).not.toHaveBeenCalled();
  });

  it('rejects out of range lookbackHours', async () => {
    const useCase = {
      execute: jest.fn(),
    };
    const controller = new InternalAppointmentReminderMetricsController(
      useCase as never,
      { getInternalToken: jest.fn(() => null) },
    );

    await expect(
      controller.getMetrics('169', undefined),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(useCase.execute).not.toHaveBeenCalled();
  });
});
