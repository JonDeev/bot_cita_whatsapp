import type { Prisma } from '@whatsapp-bot/prisma-client';

export interface AppointmentReminderOutboxRepository {
  reserve(input: {
    deduplicationKey: string;
    conversationKey: string;
    recipientPhone: string;
    payload: Prisma.InputJsonValue;
  }): Promise<void>;
  markSent(input: {
    deduplicationKey: string;
    payload: Prisma.InputJsonValue;
    sentAtIso: string;
  }): Promise<void>;
  markFailed(input: {
    deduplicationKey: string;
    errorMessage: string;
  }): Promise<void>;
}
