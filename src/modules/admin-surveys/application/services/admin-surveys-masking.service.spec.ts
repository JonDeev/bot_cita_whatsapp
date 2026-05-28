import { AdminSurveysMaskingService } from './admin-surveys-masking.service';

describe('AdminSurveysMaskingService', () => {
  const service = new AdminSurveysMaskingService();

  it('masks phone and removes raw phone from response', () => {
    const result = service.mapDispatches({
      items: [
        {
          id: 1,
          patientLegacyUserId: 12,
          patientPhone: '+573001234567',
          surveyDateIso: new Date().toISOString(),
          status: 'PENDING',
          triggerType: 'APPOINTMENT_COMPLETED',
          windowStartAtIso: new Date().toISOString(),
          windowEndAtIso: new Date().toISOString(),
          completedAtIso: null,
          failedAtIso: null,
          updatedAtIso: new Date().toISOString(),
        },
      ],
      total: 1,
      page: 1,
      pageSize: 20,
    });

    expect(result.items[0]).not.toHaveProperty('patientPhone');
    expect(result.items[0].patientPhoneMasked).toBe('***4567');
  });
});
