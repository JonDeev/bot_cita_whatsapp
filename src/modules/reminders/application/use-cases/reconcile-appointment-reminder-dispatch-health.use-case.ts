import { Inject, Injectable } from '@nestjs/common';
import { AuditService } from '../../../audit/application/services/audit.service';
import { APPOINTMENT_REMINDER_DISPATCH_REPOSITORY } from '../../domain/reminders.tokens';
import type { AppointmentReminderDispatchRepository } from '../../domain/ports/appointment-reminder-dispatch.repository';
import { AppointmentReminderDispatchConfigService } from '../services/appointment-reminder-dispatch-config.service';

export interface ReconcileAppointmentReminderDispatchHealthResult {
  recoveredLocks: number;
  expiredVerifications: number;
}

@Injectable()
export class ReconcileAppointmentReminderDispatchHealthUseCase {
  constructor(
    @Inject(APPOINTMENT_REMINDER_DISPATCH_REPOSITORY)
    private readonly dispatchRepository: AppointmentReminderDispatchRepository,
    private readonly configService: AppointmentReminderDispatchConfigService,
    private readonly auditService: AuditService,
  ) {}

  async execute(input?: {
    runAtIso?: string;
  }): Promise<ReconcileAppointmentReminderDispatchHealthResult> {
    const runAtIso = input?.runAtIso ?? new Date().toISOString();

    const [recoveredLocks, expiredVerifications] = await Promise.all([
      this.dispatchRepository.recoverExpiredLocks({
        runAtIso,
        limit: this.configService.getRecoveryBatchSize(),
      }),
      this.dispatchRepository.expirePendingPhoneVerifications({
        runAtIso,
        limit: this.configService.getRecoveryBatchSize(),
      }),
    ]);

    if (recoveredLocks > 0) {
      await this.auditService.record('appointment_reminder.dispatch.lock_recovered', {
        recoveredLocks,
      });
    }

    if (expiredVerifications > 0) {
      await this.auditService.record(
        'appointment_reminder.dispatch.verification_expired',
        {
          expiredVerifications,
        },
      );
    }

    return {
      recoveredLocks,
      expiredVerifications,
    };
  }
}
