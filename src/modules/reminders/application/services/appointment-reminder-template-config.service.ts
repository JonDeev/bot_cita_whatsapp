import { Injectable } from '@nestjs/common';

@Injectable()
export class AppointmentReminderTemplateConfigService {
  private static readonly PRIMARY_CONFIRM_BUTTON_PAYLOAD_PREFIX = 'arc:';
  private static readonly PRIMARY_REJECT_BUTTON_PAYLOAD_PREFIX = 'arr:';
  private static readonly LEGACY_CONFIRM_BUTTON_PAYLOAD_PREFIX =
    'appt_reminder_confirm:';
  private static readonly LEGACY_REJECT_BUTTON_PAYLOAD_PREFIX =
    'appt_reminder_reject:';

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
    return AppointmentReminderTemplateConfigService
      .PRIMARY_CONFIRM_BUTTON_PAYLOAD_PREFIX;
  }

  getRejectButtonPayloadPrefix(): string {
    return AppointmentReminderTemplateConfigService
      .PRIMARY_REJECT_BUTTON_PAYLOAD_PREFIX;
  }

  getConfirmButtonPayloadPrefixes(): readonly string[] {
    return [
      AppointmentReminderTemplateConfigService
        .PRIMARY_CONFIRM_BUTTON_PAYLOAD_PREFIX,
      AppointmentReminderTemplateConfigService
        .LEGACY_CONFIRM_BUTTON_PAYLOAD_PREFIX,
    ];
  }

  getRejectButtonPayloadPrefixes(): readonly string[] {
    return [
      AppointmentReminderTemplateConfigService
        .PRIMARY_REJECT_BUTTON_PAYLOAD_PREFIX,
      AppointmentReminderTemplateConfigService
        .LEGACY_REJECT_BUTTON_PAYLOAD_PREFIX,
    ];
  }

  private readRequiredEnv(key: string, fallback: string): string {
    const value = (process.env[key] ?? '').trim();
    return value || fallback;
  }
}
