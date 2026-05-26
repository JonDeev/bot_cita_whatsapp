import { AuditService } from '../../../audit/application/services/audit.service';
import type { AppointmentReminderDispatchRepository } from '../../domain/ports/appointment-reminder-dispatch.repository';
import { AppointmentReminderDispatchConfigService } from '../services/appointment-reminder-dispatch-config.service';
import { ReconcileAppointmentReminderDispatchHealthUseCase } from './reconcile-appointment-reminder-dispatch-health.use-case';

describe('ReconcileAppointmentReminderDispatchHealthUseCase', () => {
  it('recovers locks and expires verifications with configured batch size', async () => {
    const dispatchRepository: Pick<
      AppointmentReminderDispatchRepository,
      'recoverExpiredLocks' | 'expirePendingPhoneVerifications'
    > = {
      recoverExpiredLocks: jest.fn().mockResolvedValue(2),
      expirePendingPhoneVerifications: jest.fn().mockResolvedValue(3),
    };
    const configService: Pick<
      AppointmentReminderDispatchConfigService,
      'getRecoveryBatchSize'
    > = {
      getRecoveryBatchSize: jest.fn().mockReturnValue(50),
    };
    const recordAudit = jest.fn().mockResolvedValue(undefined);
    const auditService = {
      record: recordAudit,
    } as unknown as AuditService;

    const useCase = new ReconcileAppointmentReminderDispatchHealthUseCase(
      dispatchRepository as AppointmentReminderDispatchRepository,
      configService as AppointmentReminderDispatchConfigService,
      auditService,
    );

    const result = await useCase.execute({
      runAtIso: '2026-05-26T10:00:00.000Z',
    });

    expect(dispatchRepository.recoverExpiredLocks).toHaveBeenCalledWith({
      runAtIso: '2026-05-26T10:00:00.000Z',
      limit: 50,
    });
    expect(
      dispatchRepository.expirePendingPhoneVerifications,
    ).toHaveBeenCalledWith({
      runAtIso: '2026-05-26T10:00:00.000Z',
      limit: 50,
    });
    expect(recordAudit).toHaveBeenCalledWith(
      'appointment_reminder.dispatch.lock_recovered',
      { recoveredLocks: 2 },
    );
    expect(recordAudit).toHaveBeenCalledWith(
      'appointment_reminder.dispatch.verification_expired',
      { expiredVerifications: 3 },
    );
    expect(result).toEqual({
      recoveredLocks: 2,
      expiredVerifications: 3,
    });
  });

  it('skips audit when no records are reconciled', async () => {
    const recordAudit = jest.fn().mockResolvedValue(undefined);
    const auditService = {
      record: recordAudit,
    } as unknown as AuditService;
    const dispatchRepository: Pick<
      AppointmentReminderDispatchRepository,
      'recoverExpiredLocks' | 'expirePendingPhoneVerifications'
    > = {
      recoverExpiredLocks: jest.fn().mockResolvedValue(0),
      expirePendingPhoneVerifications: jest.fn().mockResolvedValue(0),
    };
    const configService: Pick<
      AppointmentReminderDispatchConfigService,
      'getRecoveryBatchSize'
    > = {
      getRecoveryBatchSize: jest.fn().mockReturnValue(25),
    };

    const useCase = new ReconcileAppointmentReminderDispatchHealthUseCase(
      dispatchRepository as AppointmentReminderDispatchRepository,
      configService as AppointmentReminderDispatchConfigService,
      auditService,
    );

    const result = await useCase.execute({
      runAtIso: '2026-05-26T10:00:00.000Z',
    });

    expect(recordAudit).not.toHaveBeenCalled();
    expect(result).toEqual({
      recoveredLocks: 0,
      expiredVerifications: 0,
    });
  });
});
