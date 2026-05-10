import { SurveyWhatsappPhoneNormalizerService } from './survey-whatsapp-phone-normalizer.service';

describe('SurveyWhatsappPhoneNormalizerService', () => {
  const service = new SurveyWhatsappPhoneNormalizerService();

  it('sanitizes and validates a Colombian mobile number', () => {
    expect(service.sanitize('(300) 111-2233')).toBe('3001112233');
    expect(service.isValidLegacyColombianMobile('(300) 111-2233')).toBe(true);
  });

  it('builds the WhatsApp recipient with country code 57', () => {
    expect(service.toWhatsappRecipient('3001112233')).toBe('573001112233');
  });
});
