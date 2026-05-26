import { BadRequestException } from '@nestjs/common';
import { AuditService } from '../../../audit/application/services/audit.service';
import { GetAppointmentReminderMetricsUseCase } from './get-appointment-reminder-metrics.use-case';

describe('GetAppointmentReminderMetricsUseCase', () => {
  it('returns operational snapshot and records audit event', async () => {
    const repository = {
      getOperationalSnapshot: jest.fn().mockResolvedValue({
        generatedAtIso: '2026-05-26T10:00:00.000Z',
        lookbackHours: 24,
        backlog: {
          dueDispatches: 10,
          oldestDueScheduledForIso: '2026-05-26T09:45:00.000Z',
          maxLagSeconds: 900,
        },
        states: {
          pending: 5,
          locked: 0,
          phoneVerificationPending: 1,
          phoneVerificationExpired: 0,
          sent: 20,
          failed: 2,
          skipped: 3,
        },
        recent: {
          created: 30,
          sent: 20,
          failed: 2,
          skipped: 3,
          verificationRequested: 4,
          sendLatencySecondsAvg: 55.3,
          sendLatencySecondsP95Approx: 120,
        },
        reliability: {
          duplicateInboundIgnoredEvents: 1,
          lockRecoveredEvents: 2,
          lockLostEvents: 1,
        },
      }),
    };
    const auditRecordSpy = jest.fn().mockResolvedValue(undefined);
    const auditService = {
      record: auditRecordSpy,
    } as unknown as AuditService;

    const useCase = new GetAppointmentReminderMetricsUseCase(
      repository,
      auditService,
    );

    const result = await useCase.execute();

    expect(result.timezone).toBe('America/Bogota');
    expect(result.backlog.dueDispatches).toBe(10);
    expect(auditRecordSpy).toHaveBeenCalledWith(
      'appointment_reminder.metrics.queried',
      expect.objectContaining({
        lookbackHours: 24,
        dueDispatches: 10,
      }),
    );
  });

  it('rejects out-of-range lookback hours', async () => {
    const auditService = {
      record: jest.fn().mockResolvedValue(undefined),
    } as unknown as AuditService;

    const useCase = new GetAppointmentReminderMetricsUseCase(
      { getOperationalSnapshot: jest.fn() },
      auditService,
    );

    await expect(useCase.execute({ lookbackHours: 0 })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(
      useCase.execute({ lookbackHours: 169 }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
