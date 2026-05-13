import {
  BotContactChannel,
  BotContactConsentPurpose,
  BotContactSuppressionReason,
} from '@whatsapp-bot/prisma-client';
import { Injectable } from '@nestjs/common';
import { PrismaBotService } from '../../../../../shared/infrastructure/prisma-bot/prisma-bot.service';
import type { SurveyRecipientPolicyRepository } from '../../../domain/ports/survey-recipient-policy.repository';

@Injectable()
export class PrismaBotSurveyRecipientPolicyRepository implements SurveyRecipientPolicyRepository {
  constructor(private readonly prismaBot: PrismaBotService) {}

  async hasGrantedSatisfactionSurveyConsent(input: {
    patientLegacyUserId: number;
    phone: string;
  }): Promise<boolean> {
    const consent = await this.prismaBot.botPatientContactConsent.findUnique({
      where: {
        patientLegacyUserId_channel_purpose: {
          patientLegacyUserId: input.patientLegacyUserId,
          channel: BotContactChannel.WHATSAPP,
          purpose: BotContactConsentPurpose.SATISFACTION_SURVEYS,
        },
      },
      select: {
        granted: true,
        phone: true,
      },
    });

    if (!consent?.granted) {
      return false;
    }

    const consentPhone = this.normalizePhone(consent.phone);
    const inputPhone = this.normalizePhone(input.phone);

    return consentPhone === inputPhone || consentPhone === `57${inputPhone}`;
  }

  async isPhoneSuppressedForSatisfactionSurveys(input: {
    phone: string;
  }): Promise<boolean> {
    const normalizedPhone = this.normalizePhone(input.phone);
    const candidatePhones = [normalizedPhone, `57${normalizedPhone}`];

    const suppressed = await this.prismaBot.botContactSuppression.findFirst({
      where: {
        phone: {
          in: candidatePhones,
        },
        channel: BotContactChannel.WHATSAPP,
        active: true,
        reason: {
          in: [
            BotContactSuppressionReason.UNKNOWN_PERSON,
            BotContactSuppressionReason.OPT_OUT_SURVEY,
            BotContactSuppressionReason.INVALID_PHONE,
            BotContactSuppressionReason.MANUAL_BLOCK,
          ],
        },
      },
      select: {
        id: true,
      },
    });

    return Boolean(suppressed);
  }

  private normalizePhone(value: string): string {
    return value.replace(/\D/g, '');
  }
}
