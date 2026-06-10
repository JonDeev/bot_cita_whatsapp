import { Injectable } from '@nestjs/common';

@Injectable()
export class AppointmentReminderPhoneNormalizerService {
  normalizeLegacyPhone(rawPhone: string | null | undefined): string | null {
    if (!rawPhone) {
      return null;
    }

    const digitsOnly = rawPhone.replace(/\D+/g, '');
    if (!/^3\d{9}$/.test(digitsOnly)) {
      return null;
    }

    return digitsOnly;
  }

  normalizeE164Colombia(rawPhone: string | null | undefined): string | null {
    if (!rawPhone) {
      return null;
    }

    const digitsOnly = rawPhone.replace(/\D+/g, '');
    if (!/^573\d{9}$/.test(digitsOnly)) {
      return null;
    }

    return digitsOnly;
  }

  toE164Colombia(normalizedLegacyPhone: string): string {
    return `57${normalizedLegacyPhone}`;
  }

  maskPhone(phone: string | null | undefined): string {
    if (!phone) {
      return '***';
    }

    if (phone.length <= 4) {
      return `${'*'.repeat(Math.max(phone.length - 1, 0))}${phone.slice(-1)}`;
    }

    const suffix = phone.slice(-4);
    return `******${suffix}`;
  }
}
