import { Injectable } from '@nestjs/common';

@Injectable()
export class WhatsappConfigService {
  getVerifyToken(): string {
    return this.readStringEnv('WHATSAPP_VERIFY_TOKEN');
  }

  getAppSecret(): string {
    return this.readStringEnv('WHATSAPP_APP_SECRET');
  }

  getAccessToken(): string {
    return this.readStringEnv('WHATSAPP_ACCESS_TOKEN');
  }

  getPhoneNumberId(): string {
    return this.readStringEnv('WHATSAPP_PHONE_NUMBER_ID');
  }

  getApiBaseUrl(): string {
    const value = this.readStringEnv('WHATSAPP_API_BASE_URL');
    return value || 'https://graph.facebook.com';
  }

  getApiVersion(): string {
    const value = this.readStringEnv('WHATSAPP_API_VERSION');
    return value || 'v22.0';
  }

  getInteractiveEventMaxAgeSeconds(): number | null {
    return this.readOptionalPositiveNumberEnv('WHATSAPP_INTERACTIVE_EVENT_MAX_AGE_SECONDS');
  }

  getTextEventMaxAgeSeconds(): number | null {
    return this.readOptionalPositiveNumberEnv('WHATSAPP_TEXT_EVENT_MAX_AGE_SECONDS');
  }

  shouldStoreWebhookPayloads(): boolean {
    return this.readBooleanEnv('WHATSAPP_STORE_WEBHOOK_PAYLOADS', true);
  }

  isAutoReplyEnabled(): boolean {
    return this.readBooleanEnv('WHATSAPP_AUTO_REPLY_ENABLED', false);
  }

  private readStringEnv(key: string): string {
    return (process.env[key] ?? '').trim();
  }

  private readBooleanEnv(key: string, fallback: boolean): boolean {
    const value = this.readStringEnv(key);
    if (!value) {
      return fallback;
    }

    return value.toLowerCase() === 'true';
  }

  private readOptionalPositiveNumberEnv(key: string): number | null {
    const value = this.readStringEnv(key);
    if (!value) {
      return null;
    }

    const parsedValue = Number(value);
    if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
      return null;
    }

    return parsedValue;
  }
}
