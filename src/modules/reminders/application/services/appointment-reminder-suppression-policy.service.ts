import { BotContactSuppressionReason } from '@whatsapp-bot/prisma-client';
import { Injectable } from '@nestjs/common';
import type {
  AppointmentReminderContactSuppressionDecision,
} from '../../domain/ports/appointment-reminder-recipient-policy.repository';

const REMINDER_PHONE_SCOPED_BLOCKING_REASONS = [
  BotContactSuppressionReason.UNKNOWN_PERSON,
  BotContactSuppressionReason.INVALID_PHONE,
  BotContactSuppressionReason.MANUAL_BLOCK,
] as const;

const REMINDER_PATIENT_SCOPED_BLOCKING_REASONS = [
  BotContactSuppressionReason.MANUAL_BLOCK,
] as const;

const REMINDER_SUPPRESSION_DECISION_BY_REASON = {
  [BotContactSuppressionReason.UNKNOWN_PERSON]: {
    kind: 'BLOCK_SUPPRESSED_CONTACT',
    reason: 'UNKNOWN_PERSON',
  },
  [BotContactSuppressionReason.INVALID_PHONE]: {
    kind: 'BLOCK_INVALID_PHONE',
  },
  [BotContactSuppressionReason.MANUAL_BLOCK]: {
    kind: 'BLOCK_SUPPRESSED_CONTACT',
    reason: 'MANUAL_BLOCK',
  },
  [BotContactSuppressionReason.OPT_OUT_SURVEY]: {
    kind: 'ALLOW_CONTACT',
  },
} as const satisfies Record<
  BotContactSuppressionReason,
  AppointmentReminderContactSuppressionDecision
>;

const REMINDER_SUPPRESSION_REASON_PRIORITY = [
  BotContactSuppressionReason.INVALID_PHONE,
  BotContactSuppressionReason.MANUAL_BLOCK,
  BotContactSuppressionReason.UNKNOWN_PERSON,
  BotContactSuppressionReason.OPT_OUT_SURVEY,
] as const;

@Injectable()
export class AppointmentReminderSuppressionPolicyService {
  getPhoneScopedBlockingReasons(): readonly BotContactSuppressionReason[] {
    return REMINDER_PHONE_SCOPED_BLOCKING_REASONS;
  }

  getPatientScopedBlockingReasons(): readonly BotContactSuppressionReason[] {
    return REMINDER_PATIENT_SCOPED_BLOCKING_REASONS;
  }

  resolve(
    reason: BotContactSuppressionReason,
  ): AppointmentReminderContactSuppressionDecision {
    return REMINDER_SUPPRESSION_DECISION_BY_REASON[reason];
  }

  resolveHighestPriority(
    reasons: readonly BotContactSuppressionReason[],
  ): AppointmentReminderContactSuppressionDecision {
    for (const prioritizedReason of REMINDER_SUPPRESSION_REASON_PRIORITY) {
      if (reasons.includes(prioritizedReason)) {
        return this.resolve(prioritizedReason);
      }
    }

    return {
      kind: 'ALLOW_CONTACT',
    };
  }
}
