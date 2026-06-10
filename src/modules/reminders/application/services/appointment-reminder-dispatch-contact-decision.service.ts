import { Injectable } from '@nestjs/common';
import type { AppointmentReminderContactSuppressionDecision } from '../../domain/ports/appointment-reminder-recipient-policy.repository';

export type AppointmentReminderDispatchContactDecision =
  | {
      kind: 'SEND_REMINDER';
      recipientPhoneE164: string;
    }
  | {
      kind: 'SEND_PHONE_VERIFICATION';
      recipientPhoneE164: string;
    }
  | {
      kind: 'SKIP_INVALID_PHONE';
    }
  | {
      kind: 'SKIP_SUPPRESSED_CONTACT';
      suppressionReason: 'UNKNOWN_PERSON' | 'MANUAL_BLOCK';
    };

export interface AppointmentReminderDispatchContactDecisionInput {
  recipientPhoneE164: string;
  hasAppointmentNotificationsOptIn: boolean;
  suppressionDecision: AppointmentReminderContactSuppressionDecision;
}

@Injectable()
export class AppointmentReminderDispatchContactDecisionService {
  resolve(
    input: AppointmentReminderDispatchContactDecisionInput,
  ): AppointmentReminderDispatchContactDecision {
    if (input.suppressionDecision.kind === 'BLOCK_INVALID_PHONE') {
      return {
        kind: 'SKIP_INVALID_PHONE',
      };
    }

    if (input.suppressionDecision.kind === 'BLOCK_SUPPRESSED_CONTACT') {
      return {
        kind: 'SKIP_SUPPRESSED_CONTACT',
        suppressionReason: input.suppressionDecision.reason,
      };
    }

    if (input.hasAppointmentNotificationsOptIn) {
      return {
        kind: 'SEND_REMINDER',
        recipientPhoneE164: input.recipientPhoneE164,
      };
    }

    return {
      kind: 'SEND_PHONE_VERIFICATION',
      recipientPhoneE164: input.recipientPhoneE164,
    };
  }
}
