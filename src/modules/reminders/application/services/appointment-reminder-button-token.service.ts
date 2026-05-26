import { Injectable } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';

export interface ReminderButtonTokenPayload {
  dispatchId: number;
  expiresAtIso: string;
}

export interface VerifiedReminderButtonToken {
  dispatchId: number;
  expiresAtIso: string;
}

@Injectable()
export class AppointmentReminderButtonTokenService {
  createToken(payload: ReminderButtonTokenPayload): string {
    const body = JSON.stringify(payload);
    const bodyBase64 = this.encode(body);
    const signature = this.sign(bodyBase64);
    return `${bodyBase64}.${signature}`;
  }

  verifyToken(token: string): VerifiedReminderButtonToken | null {
    const trimmedToken = token.trim();
    if (!trimmedToken) {
      return null;
    }

    const parts = trimmedToken.split('.');
    if (parts.length !== 2) {
      return null;
    }

    const [bodyBase64, signature] = parts;
    if (!bodyBase64 || !signature) {
      return null;
    }

    const expected = this.sign(bodyBase64);
    const signatureBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expected);
    if (signatureBuffer.length !== expectedBuffer.length) {
      return null;
    }

    if (!timingSafeEqual(signatureBuffer, expectedBuffer)) {
      return null;
    }

    const decodedJson = this.decode(bodyBase64);
    if (!decodedJson) {
      return null;
    }

    const parsed = this.parsePayload(decodedJson);
    if (!parsed) {
      return null;
    }

    if (Date.now() > Date.parse(parsed.expiresAtIso)) {
      return null;
    }

    return parsed;
  }

  hashToken(token: string): string {
    return createHmac('sha256', this.getSecret()).update(token).digest('hex');
  }

  private parsePayload(rawJson: string): VerifiedReminderButtonToken | null {
    try {
      const value = JSON.parse(rawJson) as {
        dispatchId?: unknown;
        expiresAtIso?: unknown;
      };

      if (!Number.isInteger(value.dispatchId) || (value.dispatchId as number) <= 0) {
        return null;
      }

      if (
        typeof value.expiresAtIso !== 'string' ||
        !value.expiresAtIso.trim() ||
        Number.isNaN(Date.parse(value.expiresAtIso))
      ) {
        return null;
      }

      return {
        dispatchId: value.dispatchId as number,
        expiresAtIso: value.expiresAtIso,
      };
    } catch {
      return null;
    }
  }

  private sign(bodyBase64: string): string {
    return createHmac('sha256', this.getSecret()).update(bodyBase64).digest('hex');
  }

  private getSecret(): string {
    const secret =
      (process.env.APPOINTMENT_REMINDERS_BUTTON_SIGNING_SECRET ?? '').trim() ||
      (process.env.WHATSAPP_VERIFY_TOKEN ?? '').trim();

    if (!secret) {
      throw new Error(
        'Missing APPOINTMENT_REMINDERS_BUTTON_SIGNING_SECRET (or WHATSAPP_VERIFY_TOKEN fallback).',
      );
    }

    return secret;
  }

  private encode(value: string): string {
    return Buffer.from(value, 'utf8').toString('base64url');
  }

  private decode(value: string): string | null {
    try {
      return Buffer.from(value, 'base64url').toString('utf8');
    } catch {
      return null;
    }
  }
}
