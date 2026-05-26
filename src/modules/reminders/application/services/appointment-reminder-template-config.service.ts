import { Injectable } from '@nestjs/common';

@Injectable()
export class AppointmentReminderTemplateConfigService {
  getReminderTemplateName(): string {
    return this.readRequiredEnv(
      'WHATSAPP_APPOINTMENT_REMINDER_TEMPLATE_NAME',
      'recordatorio_cita_24h',
    );
  }

  getVerificationTemplateName(): string {
    return this.readRequiredEnv(
      'WHATSAPP_APPOINTMENT_REMINDER_VERIFICATION_TEMPLATE_NAME',
      'verificacion_telefono_paciente',
    );
  }

  getTemplateLanguageCode(): string {
    return this.readRequiredEnv(
      'WHATSAPP_APPOINTMENT_REMINDER_TEMPLATE_LANGUAGE_CODE',
      'es_CO',
    );
  }

  getReminderType(): string {
    return 'APPOINTMENT_24H';
  }

  getConfirmButtonPayloadPrefix(): string {
    return 'appt_reminder_confirm:';
  }

  getRejectButtonPayloadPrefix(): string {
    return 'appt_reminder_reject:';
  }

  private readRequiredEnv(key: string, fallback: string): string {
    const value = (process.env[key] ?? '').trim();
    return value || fallback;
  }
}
