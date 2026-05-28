import { AdminRemindersMaskingService } from './admin-reminders-masking.service';

describe('AdminRemindersMaskingService', () => {
  const service = new AdminRemindersMaskingService();
  const baseItem = {
    id: 1,
    legacyAgendaId: 100,
    patientLegacyUserId: 200,
    recipientPhoneRaw: '3001234567',
    recipientPhoneE164: '+573001234567',
    reminderType: 'ONE_HOUR_BEFORE',
    status: 'FAILED',
    attempts: 2,
    scheduledForIso: new Date().toISOString(),
    sentAtIso: null,
    updatedAtIso: new Date().toISOString(),
    lastError: 'provider timeout',
  };

  it('hides technical error details for SUPERVISOR', () => {
    const result = service.mapDispatches('SUPERVISOR', {
      items: [baseItem],
      total: 1,
      page: 1,
      pageSize: 20,
    });

    expect(result.items[0].recipientPhoneMasked).toBe('***4567');
    expect(result.items[0].lastError).toBeNull();
  });

  it('keeps technical error details for ADMIN', () => {
    const result = service.mapDispatches('ADMIN', {
      items: [baseItem],
      total: 1,
      page: 1,
      pageSize: 20,
    });

    expect(result.items[0].lastError).toBe('provider timeout');
  });
});
