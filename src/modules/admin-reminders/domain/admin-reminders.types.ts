export interface AdminReminderDispatchItem {
  id: number;
  legacyAgendaId: number;
  patientLegacyUserId: number;
  recipientPhoneRaw: string;
  recipientPhoneE164: string | null;
  reminderType: string;
  status: string;
  attempts: number;
  scheduledForIso: string;
  sentAtIso: string | null;
  updatedAtIso: string;
  lastError: string | null;
}

export interface AdminReminderDispatchListResult {
  items: AdminReminderDispatchItem[];
  total: number;
  page: number;
  pageSize: number;
}
