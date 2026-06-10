import { Injectable } from '@nestjs/common';
import { randomBytes } from 'node:crypto';

const ACTION_KEY_NUM_RANDOM_BYTES = 16;
const ACTION_KEY_PATTERN = /^[A-Za-z0-9_-]{16,64}$/;

@Injectable()
export class AppointmentReminderVerificationActionKeyService {
  create(): string {
    return randomBytes(ACTION_KEY_NUM_RANDOM_BYTES).toString('base64url');
  }

  isValid(actionKey: string): boolean {
    return ACTION_KEY_PATTERN.test(actionKey);
  }
}
