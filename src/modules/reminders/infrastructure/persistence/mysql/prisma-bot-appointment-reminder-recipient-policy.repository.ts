import {
  BotContactChannel,
  BotContactConsentPurpose,
  BotContactSuppressionReason,
} from '@whatsapp-bot/prisma-client';
import { Injectable } from '@nestjs/common';
import { PrismaBotService } from '../../../../../shared/infrastructure/prisma-bot/prisma-bot.service';
import type { AppointmentReminderRecipientPolicyRepository } from '../../../domain/ports/appointment-reminder-recipient-policy.repository';

@Injectable()
export class PrismaBotAppointmentReminderRecipientPolicyRepository
  implements AppointmentReminderRecipientPolicyRepository
{
  constructor(private readonly prismaBot: PrismaBotService) {}

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

  async hasActiveSuppression(input: {
    patientLegacyUserId: number;
    phone: string;
  }): Promise<boolean> {
    const suppression = await this.prismaBot.botContactSuppression.findFirst({
      where: {
        channel: BotContactChannel.WHATSAPP,
        active: true,
        OR: [
          { patientLegacyUserId: input.patientLegacyUserId },
          { phone: input.phone },
        ],
      },
      select: {
        id: true,
      },
    });

    return Boolean(suppression);
  }

  async clearUnknownPersonSuppression(input: {
    patientLegacyUserId: number;
    phone: string;
  }): Promise<boolean> {
    const suppression = await this.prismaBot.botContactSuppression.findFirst({
      where: {
        channel: BotContactChannel.WHATSAPP,
        active: true,
        reason: BotContactSuppressionReason.UNKNOWN_PERSON,
        scope: 'APPOINTMENT_NOTIFICATIONS',
        patientLegacyUserId: input.patientLegacyUserId,
        phone: input.phone,
      },
      select: {
        id: true,
      },
    });

    if (!suppression) {
      return false;
    }

    await this.prismaBot.botContactSuppression.update({
      where: {
        id: suppression.id,
      },
      data: {
        active: false,
      },
    });

    return true;
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
    const existing = await this.prismaBot.botContactSuppression.findFirst({
      where: {
        patientLegacyUserId: input.patientLegacyUserId,
        phone: input.phone,
        channel: BotContactChannel.WHATSAPP,
        reason: BotContactSuppressionReason.UNKNOWN_PERSON,
      },
      select: { id: true },
    });

    if (existing) {
      await this.prismaBot.botContactSuppression.update({
        where: { id: existing.id },
        data: {
          active: true,
          notes: input.notes ?? null,
        },
      });
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
}
