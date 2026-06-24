import { Injectable } from '@nestjs/common';

@Injectable()
export class SurveyPhoneVerificationTemplateConfigService {
  private static readonly CONFIRM_BUTTON_PAYLOAD_PREFIX = 'ssv_confirm:';
  private static readonly REJECT_BUTTON_PAYLOAD_PREFIX = 'ssv_reject:';

  getTemplateName(): string {
    return this.readRequiredEnv(
      'WHATSAPP_SURVEY_PHONE_VERIFICATION_TEMPLATE_NAME',
      'verificacion_telefono_paciente',
    );
  }

  getTemplateLanguageCode(): string {
    return this.readRequiredEnv(
      'WHATSAPP_SURVEY_PHONE_VERIFICATION_TEMPLATE_LANGUAGE_CODE',
      'es_CO',
    );
  }

  getConfirmButtonPayloadPrefix(): string {
    return SurveyPhoneVerificationTemplateConfigService.CONFIRM_BUTTON_PAYLOAD_PREFIX;
  }

  getRejectButtonPayloadPrefix(): string {
    return SurveyPhoneVerificationTemplateConfigService.REJECT_BUTTON_PAYLOAD_PREFIX;
  }

  private readRequiredEnv(key: string, fallback: string): string {
    const value = (process.env[key] ?? '').trim();
    return value || fallback;
  }
}
