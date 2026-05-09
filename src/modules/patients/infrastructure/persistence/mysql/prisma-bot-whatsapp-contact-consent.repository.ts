import {
  BotContactChannel,
  BotContactConsentPurpose,
  BotContactConsentResponse,
} from '@whatsapp-bot/prisma-client';
import { Injectable } from '@nestjs/common';
import { PrismaBotService } from '../../../../../shared/infrastructure/prisma-bot/prisma-bot.service';
import type {
  RecordWhatsappContactConsentCommand,
  WhatsappContactConsentRepository,
} from '../../../domain/ports/whatsapp-contact-consent.repository';

@Injectable()
export class PrismaBotWhatsappContactConsentRepository
  implements WhatsappContactConsentRepository
{
  constructor(private readonly prismaBot: PrismaBotService) {}

  async recordConsent(command: RecordWhatsappContactConsentCommand): Promise<void> {
    const respondedAt = new Date(command.respondedAtIso);
    const response = this.toConsentResponse(command.response);
    const channel = this.toChannel(command.channel);
    const granted = response === BotContactConsentResponse.ACCEPTED;

    await this.prismaBot.$transaction(async (tx) => {
      const event = await tx.botContactConsentEvent.create({
        data: {
          patientLegacyUserId: command.patientLegacyUserId,
          phone: command.phone,
          channel,
          source: command.source,
          consentTextSnapshot: command.consentTextSnapshot,
          policyUrl: command.policyUrl ?? null,
          policyVersion: command.policyVersion ?? null,
          response,
          respondedAt,
        },
      });

      for (const purpose of command.purposes) {
        const consentPurpose = this.toPurpose(purpose);

        await tx.botPatientContactConsent.upsert({
          where: {
            patientLegacyUserId_channel_purpose: {
              patientLegacyUserId: command.patientLegacyUserId,
              channel,
              purpose: consentPurpose,
            },
          },
          create: {
            consentEventId: event.id,
            patientLegacyUserId: command.patientLegacyUserId,
            phone: command.phone,
            channel,
            purpose: consentPurpose,
            granted,
            grantedAt: granted ? respondedAt : null,
            revokedAt: granted ? null : respondedAt,
          },
          update: {
            consentEventId: event.id,
            phone: command.phone,
            granted,
            grantedAt: granted ? respondedAt : null,
            revokedAt: granted ? null : respondedAt,
          },
        });
      }
    });
  }

  private toChannel(value: string): BotContactChannel {
    if (value === 'WHATSAPP') {
      return BotContactChannel.WHATSAPP;
    }

    throw new Error(`Unsupported contact channel "${value}".`);
  }

  private toPurpose(value: string): BotContactConsentPurpose {
    const byValue: Record<string, BotContactConsentPurpose> = {
      APPOINTMENT_NOTIFICATIONS: BotContactConsentPurpose.APPOINTMENT_NOTIFICATIONS,
      SATISFACTION_SURVEYS: BotContactConsentPurpose.SATISFACTION_SURVEYS,
    };

    const purpose = byValue[value];
    if (!purpose) {
      throw new Error(`Unsupported contact consent purpose "${value}".`);
    }

    return purpose;
  }

  private toConsentResponse(value: string): BotContactConsentResponse {
    const byValue: Record<string, BotContactConsentResponse> = {
      ACCEPTED: BotContactConsentResponse.ACCEPTED,
      DECLINED: BotContactConsentResponse.DECLINED,
    };

    const response = byValue[value];
    if (!response) {
      throw new Error(`Unsupported contact consent response "${value}".`);
    }

    return response;
  }
}
