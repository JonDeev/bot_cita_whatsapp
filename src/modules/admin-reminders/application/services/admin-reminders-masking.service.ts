import { Injectable } from '@nestjs/common';
import type { AdminRole } from '@whatsapp-bot/shared';
import type {
  AdminReminderDispatchItem,
  AdminReminderDispatchListResult,
} from '../../domain/admin-reminders.types';

export interface AdminReminderDispatchResponseItem
  extends Omit<AdminReminderDispatchItem, 'recipientPhoneRaw' | 'recipientPhoneE164' | 'lastError'> {
  recipientPhoneMasked: string;
  lastError: string | null;
}

@Injectable()
export class AdminRemindersMaskingService {
  mapDispatches(
    role: AdminRole,
    result: AdminReminderDispatchListResult,
  ): {
    items: AdminReminderDispatchResponseItem[];
    total: number;
    page: number;
    pageSize: number;
  } {
    return {
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
      items: result.items.map((item) => ({
        id: item.id,
        legacyAgendaId: item.legacyAgendaId,
        patientLegacyUserId: item.patientLegacyUserId,
        recipientPhoneMasked: this.maskPhone(
          item.recipientPhoneE164 ?? item.recipientPhoneRaw,
        ),
        reminderType: item.reminderType,
        status: item.status,
        attempts: item.attempts,
        scheduledForIso: item.scheduledForIso,
        sentAtIso: item.sentAtIso,
        updatedAtIso: item.updatedAtIso,
        lastError: role === 'ADMIN' ? item.lastError : null,
      })),
    };
  }

  private maskPhone(value: string): string {
    const digits = value.replace(/\D+/g, '');
    if (digits.length <= 4) {
      return '****';
    }

    return `***${digits.slice(-4)}`;
  }
}
