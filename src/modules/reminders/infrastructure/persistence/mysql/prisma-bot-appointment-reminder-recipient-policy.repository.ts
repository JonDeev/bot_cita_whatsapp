import {
  BotContactChannel,
  BotContactConsentPurpose,
  BotContactSuppressionReason,
} from '@whatsapp-bot/prisma-client';
import { Injectable } from '@nestjs/common';
import { PrismaBotService } from '../../../../../shared/infrastructure/prisma-bot/prisma-bot.service';
import { AppointmentReminderSuppressionPolicyService } from '../../../application/services/appointment-reminder-suppression-policy.service';
import type {
  AppointmentReminderContactSuppressionDecision,
  AppointmentReminderRecipientPolicyRepository,
} from '../../../domain/ports/appointment-reminder-recipient-policy.repository';

@Injectable()
export class PrismaBotAppointmentReminderRecipientPolicyRepository
  implements AppointmentReminderRecipientPolicyRepository
{
  constructor(
    private readonly prismaBot: PrismaBotService,
    private readonly suppressionPolicyService: AppointmentReminderSuppressionPolicyService,
  ) {}

  async hasAppointmentNotificationsOptIn(input: {
    patientLegacyUserId: number;
  }): Promise<boolean> {
    const consent = await this.prismaBot.botPatientContactConsent.findUnique({
      where: {
        patientLegacyUserId_channel_purpose: {
          patientLegacyUserId: input.patientLegacyUserId,
          channel: BotContactChannel.WHATSAPP,
          purpose: BotContactConsentPurpose.APPOINTMENT_NOTIFICATIONS,
        },
      },
      select: {
        granted: true,
      },
    });

    return consent?.granted === true;
  }

  async resolveReminderContactSuppression(input: {
    patientLegacyUserId: number;
    phone: string;
  }): Promise<AppointmentReminderContactSuppressionDecision> {
    const phoneFilter = this.resolvePhoneFilter(input.phone);
    const phoneScopedBlockingReasons =
      this.suppressionPolicyService.getPhoneScopedBlockingReasons();
    const patientScopedBlockingReasons =
      this.suppressionPolicyService.getPatientScopedBlockingReasons();

    const suppressions = await this.prismaBot.botContactSuppression.findMany({
      where: {
        channel: BotContactChannel.WHATSAPP,
        active: true,
        scope: 'APPOINTMENT_NOTIFICATIONS',
        OR: [
          {
            phone: {
              in: phoneFilter,
            },
            reason: {
              in: [...phoneScopedBlockingReasons],
            },
          },
          {
            patientLegacyUserId: input.patientLegacyUserId,
            reason: {
              in: [...patientScopedBlockingReasons],
            },
          },
        ],
      },
      select: {
        reason: true,
      },
    });

    return this.suppressionPolicyService.resolveHighestPriority(
      suppressions.map((suppression) => suppression.reason),
    );
  }

  async hasActiveSuppression(input: {
    patientLegacyUserId: number;
    phone: string;
  }): Promise<boolean> {
    const decision = await this.resolveReminderContactSuppression(input);
    return decision.kind !== 'ALLOW_CONTACT';
  }

  async clearUnknownPersonSuppression(input: {
    patientLegacyUserId: number;
    phone: string;
  }): Promise<boolean> {
    const phoneFilter = this.resolvePhoneFilter(input.phone);

    const result = await this.prismaBot.botContactSuppression.updateMany({
      where: {
        channel: BotContactChannel.WHATSAPP,
        active: true,
        reason: BotContactSuppressionReason.UNKNOWN_PERSON,
        scope: 'APPOINTMENT_NOTIFICATIONS',
        patientLegacyUserId: input.patientLegacyUserId,
        phone: {
          in: phoneFilter,
        },
      },
      data: {
        active: false,
      },
    });

    return result.count > 0;
  }

  async isHumanHandoffActive(input: {
    conversationKey: string | null;
  }): Promise<boolean> {
    if (!input.conversationKey) {
      return false;
    }

    const conversation = await this.prismaBot.botConversation.findUnique({
      where: {
        conversationKey: input.conversationKey,
      },
      select: {
        status: true,
      },
    });

    return conversation?.status === 'HUMAN_HANDOFF';
  }

  async upsertUnknownPersonSuppression(input: {
    patientLegacyUserId: number;
    phone: string;
    notes?: string;
  }): Promise<void> {
    const phoneFilter = this.resolvePhoneFilter(input.phone);

    const updated = await this.prismaBot.botContactSuppression.updateMany({
      where: {
        patientLegacyUserId: input.patientLegacyUserId,
        phone: {
          in: phoneFilter,
        },
        channel: BotContactChannel.WHATSAPP,
        reason: BotContactSuppressionReason.UNKNOWN_PERSON,
        scope: 'APPOINTMENT_NOTIFICATIONS',
      },
      data: {
        active: true,
        notes: input.notes ?? null,
      },
    });

    if (updated.count > 0) {
      return;
    }

    await this.prismaBot.botContactSuppression.create({
      data: {
        patientLegacyUserId: input.patientLegacyUserId,
        phone: input.phone,
        channel: BotContactChannel.WHATSAPP,
        reason: BotContactSuppressionReason.UNKNOWN_PERSON,
        scope: 'APPOINTMENT_NOTIFICATIONS',
        active: true,
        notes: input.notes ?? null,
      },
    });
  }

  private resolvePhoneCandidates(phone: string): string[] {
    const digitsOnly = phone.replace(/\D+/g, '');
    const candidates = new Set<string>();

    if (/^3\d{9}$/.test(digitsOnly)) {
      candidates.add(digitsOnly);
      candidates.add(`57${digitsOnly}`);
    } else if (/^57(3\d{9})$/.test(digitsOnly)) {
      candidates.add(digitsOnly);
      candidates.add(digitsOnly.slice(2));
    }

    return [...candidates];
  }

  private resolvePhoneFilter(phone: string): string[] {
    const candidates = this.resolvePhoneCandidates(phone);
    return candidates.length > 0 ? candidates : [phone];
  }
}
