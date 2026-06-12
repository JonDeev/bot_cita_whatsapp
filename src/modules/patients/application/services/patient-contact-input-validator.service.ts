import { Injectable } from '@nestjs/common';

const COLOMBIAN_MOBILE_PHONE_PATTERN = /^3\d{9}$/;
const SIMPLE_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

@Injectable()
export class PatientContactInputValidatorService {
  sanitizePhone(input: string): string {
    return input.replace(/\D/g, '');
  }

  normalizePhone(input: string | null | undefined): string | null {
    const sanitized = this.sanitizePhone(input ?? '');
    if (!sanitized) {
      return null;
    }

    return sanitized;
  }

  isValidColombianMobilePhone(input: string | null | undefined): boolean {
    const normalizedPhone = this.normalizePhone(input);
    if (!normalizedPhone) {
      return false;
    }

    return COLOMBIAN_MOBILE_PHONE_PATTERN.test(normalizedPhone);
  }

  isSamePhoneNumber(
    first: string | null | undefined,
    second: string | null | undefined,
  ): boolean {
    const normalizedFirst = this.normalizePhone(first);
    const normalizedSecond = this.normalizePhone(second);

    if (!normalizedFirst || !normalizedSecond) {
      return false;
    }

    return (
      normalizedFirst === normalizedSecond ||
      normalizedFirst === `57${normalizedSecond}` ||
      `57${normalizedFirst}` === normalizedSecond
    );
  }

  normalizeEmail(input: string | null | undefined): string | null {
    const normalized = (input ?? '').trim().toLowerCase();
    if (!normalized) {
      return null;
    }

    return normalized;
  }

  isValidEmail(input: string | null | undefined): boolean {
    const normalizedEmail = this.normalizeEmail(input);
    if (!normalizedEmail) {
      return false;
    }

    return SIMPLE_EMAIL_PATTERN.test(normalizedEmail);
  }

  maskPhone(input: string | null | undefined): string | null {
    const normalizedPhone = this.normalizePhone(input);
    if (!normalizedPhone) {
      return null;
    }

    const visibleDigits = normalizedPhone.slice(-2);
    return `******${visibleDigits}`;
  }

  maskEmail(input: string | null | undefined): string | null {
    const normalizedEmail = this.normalizeEmail(input);
    if (!normalizedEmail) {
      return null;
    }

    const [localPart, domainPart] = normalizedEmail.split('@');
    if (!localPart || !domainPart) {
      return '***';
    }

    const firstCharacter = localPart.slice(0, 1);
    return `${firstCharacter}***@${domainPart}`;
  }
}
