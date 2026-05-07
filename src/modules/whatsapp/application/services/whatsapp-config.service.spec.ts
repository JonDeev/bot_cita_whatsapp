import { WhatsappConfigService } from './whatsapp-config.service';

describe('WhatsappConfigService', () => {
  it('trims string environment values', () => {
    process.env.WHATSAPP_ACCESS_TOKEN = '  token-123  ';
    process.env.WHATSAPP_PHONE_NUMBER_ID = ' 112260851488328 ';
    process.env.WHATSAPP_INTERACTIVE_EVENT_MAX_AGE_SECONDS = ' 900 ';
    process.env.WHATSAPP_STORE_WEBHOOK_PAYLOADS = 'false';

    const service = new WhatsappConfigService();

    expect(service.getAccessToken()).toBe('token-123');
    expect(service.getPhoneNumberId()).toBe('112260851488328');
    expect(service.getInteractiveEventMaxAgeSeconds()).toBe(900);
    expect(service.shouldStoreWebhookPayloads()).toBe(false);
  });
});
