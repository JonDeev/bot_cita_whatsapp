import { Injectable } from '@nestjs/common';

@Injectable()
export class SurveyFlowTemplateConfigService {
  getTemplateName(): string {
    return this.readStringEnv('WHATSAPP_SURVEY_FLOW_TEMPLATE_NAME');
  }

  getTemplateLanguageCode(): string {
    const value = this.readStringEnv(
      'WHATSAPP_SURVEY_FLOW_TEMPLATE_LANGUAGE_CODE',
    );
    return value || 'es_CO';
  }

  getTemplateButtonIndex(): string {
    const value = this.readStringEnv(
      'WHATSAPP_SURVEY_FLOW_TEMPLATE_BUTTON_INDEX',
    );
    return value || '0';
  }

  private readStringEnv(key: string): string {
    return (process.env[key] ?? '').trim();
  }
}
