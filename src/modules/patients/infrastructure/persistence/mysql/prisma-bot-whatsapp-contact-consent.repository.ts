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
import type {
  WhatsappContactConsentReaderRepository,
  WhatsappContactConsentSnapshot,
} from '../../../domain/ports/whatsapp-contact-consent-reader.repository';

@Injectable()
export class PrismaBotWhatsappContactConsentRepository
  implements
    WhatsappContactConsentRepository,
    WhatsappContactConsentReaderRepository
{
  constructor(private readonly prismaBot: PrismaBotService) {}

  async recordConsent(
    command: RecordWhatsappContactConsentCommand,
  ): Promise<void> {
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

  async findConsentByPatientAndPurpose(input: {
    patientLegacyUserId: number;
    channel: 'WHATSAPP';
    purpose: 'APPOINTMENT_NOTIFICATIONS' | 'SATISFACTION_SURVEYS';
  }): Promise<WhatsappContactConsentSnapshot | null> {
    const channel = this.toChannel(input.channel);
    const purpose = this.toPurpose(input.purpose);

    const consent = await this.prismaBot.botPatientContactConsent.findUnique({
      where: {
        patientLegacyUserId_channel_purpose: {
          patientLegacyUserId: input.patientLegacyUserId,
          channel,
          purpose,
        },
      },
      select: {
        patientLegacyUserId: true,
        phone: true,
        granted: true,
        grantedAt: true,
        revokedAt: true,
      },
    });

    if (!consent) {
      return null;
    }

    return {
      patientLegacyUserId: consent.patientLegacyUserId,
      phone: consent.phone,
      channel: input.channel,
      purpose: input.purpose,
      granted: consent.granted,
      grantedAtIso: consent.grantedAt ? consent.grantedAt.toISOString() : null,
      revokedAtIso: consent.revokedAt ? consent.revokedAt.toISOString() : null,
    };
  }

  private toChannel(value: string): BotContactChannel {
    if (value === 'WHATSAPP') {
      return BotContactChannel.WHATSAPP;
    }

    throw new Error(`Unsupported contact channel "${value}".`);
  }

  private toPurpose(value: string): BotContactConsentPurpose {
    const byValue: Record<string, BotContactConsentPurpose> = {
      APPOINTMENT_NOTIFICATIONS:
        BotContactConsentPurpose.APPOINTMENT_NOTIFICATIONS,
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
