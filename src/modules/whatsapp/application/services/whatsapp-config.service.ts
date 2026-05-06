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

  isAutoReplyEnabled(): boolean {
    return this.readStringEnv('WHATSAPP_AUTO_REPLY_ENABLED').toLowerCase() === 'true';
  }

  private readStringEnv(key: string): string {
    return (process.env[key] ?? '').trim();
  }
}
