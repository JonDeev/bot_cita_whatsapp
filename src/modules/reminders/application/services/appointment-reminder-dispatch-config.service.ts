import { Injectable } from '@nestjs/common';
import { AppointmentReminderBootstrapConfigService } from './appointment-reminder-bootstrap-config.service';

@Injectable()
export class AppointmentReminderDispatchConfigService extends AppointmentReminderBootstrapConfigService {
  override isWithinReminderSendRollout(
    patientLegacyUserId: number,
    sendRolloutPercent?: number,
  ): boolean {
    const rolloutPercent = sendRolloutPercent ?? this.getSendRolloutPercent();
    if (rolloutPercent >= 100) {
      return true;
    }

    if (rolloutPercent <= 0) {
      return false;
    }

    const cohortBucket = Math.abs(Math.trunc(patientLegacyUserId)) % 100;
    return cohortBucket < rolloutPercent;
  }
}
