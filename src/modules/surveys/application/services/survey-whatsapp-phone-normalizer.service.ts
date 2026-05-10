import { Injectable } from '@nestjs/common';

const COLOMBIAN_MOBILE_PHONE_PATTERN = /^3\d{9}$/;

@Injectable()
export class SurveyWhatsappPhoneNormalizerService {
  sanitize(input: string): string {
    return input.replace(/\D/g, '');
  }

  isValidLegacyColombianMobile(input: string): boolean {
    return COLOMBIAN_MOBILE_PHONE_PATTERN.test(this.sanitize(input));
  }

  toWhatsappRecipient(input: string): string {
    const sanitizedPhone = this.sanitize(input);
    if (!COLOMBIAN_MOBILE_PHONE_PATTERN.test(sanitizedPhone)) {
      throw new Error('Invalid Colombian mobile phone for survey dispatch.');
    }

    return `57${sanitizedPhone}`;
  }
}
