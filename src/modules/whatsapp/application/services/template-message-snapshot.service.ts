import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import type {
  TemplateMessageSnapshot,
  TemplateMessageSnapshotButton,
  TemplateMessageSnapshotButtonPayload,
  TemplateMessageSnapshotFlowMetadata,
} from '../../../conversations/domain/ports/conversation-message.repository';

const TEMPLATE_SNAPSHOT_VERSION = '1' as const;
const SURVEY_FLOW_INVITATION_CTA_LABEL = 'Responder encuesta' as const;

type TemplateSnapshotCore = Omit<TemplateMessageSnapshot, 'renderedHash'>;
type TemplateSnapshotHashInput = Pick<
  TemplateMessageSnapshot,
  | 'templateName'
  | 'templateLanguageCode'
  | 'templateVariant'
  | 'visibleBody'
  | 'visibleButtons'
  | 'snapshotVersion'
> & {
  flowMetadata: Pick<TemplateMessageSnapshotFlowMetadata, 'ctaLabel'> | null;
};

@Injectable()
export class TemplateMessageSnapshotService {
  buildAppointmentReminderSnapshot(input: {
    templateName: string;
    languageCode: string;
    bodyTextParameters: readonly string[];
  }): TemplateMessageSnapshot {
    const parameters = this.normalizeParameters(input.bodyTextParameters);
    const visibleBody = this.renderAppointmentReminderBody(parameters);

    return this.buildSnapshot({
      templateName: input.templateName,
      templateLanguageCode: input.languageCode,
      templateVariant: 'APPOINTMENT_REMINDER',
      visibleBody,
      bodyTextParameters: parameters,
      visibleButtons: [],
      buttonPayloads: [],
      snapshotVersion: TEMPLATE_SNAPSHOT_VERSION,
    });
  }

  buildSurveyPhoneVerificationSnapshot(input: {
    templateName: string;
    languageCode: string;
    bodyTextParameters: readonly string[];
    visibleButtons: readonly TemplateMessageSnapshotButton[];
    buttonPayloads?: readonly TemplateMessageSnapshotButtonPayload[];
  }): TemplateMessageSnapshot {
    const parameters = this.normalizeParameters(input.bodyTextParameters);
    const visibleBody = this.renderSurveyPhoneVerificationBody(parameters[0]);

    return this.buildSnapshot({
      templateName: input.templateName,
      templateLanguageCode: input.languageCode,
      templateVariant: 'SURVEY_PHONE_VERIFICATION',
      visibleBody,
      bodyTextParameters: parameters,
      visibleButtons: input.visibleButtons.map((button) => ({
        index: button.index.trim(),
        title: button.title.trim(),
      })),
      buttonPayloads: (input.buttonPayloads ?? []).map((button) => ({
        index: button.index.trim(),
        payload: button.payload.trim(),
      })),
      snapshotVersion: TEMPLATE_SNAPSHOT_VERSION,
    });
  }

  buildSurveyFlowInvitationSnapshot(input: {
    templateName: string;
    languageCode: string;
    bodyTextParameters: readonly string[];
    buttonIndex: string;
    dispatchId?: string;
    surveyDateIso?: string;
  }): TemplateMessageSnapshot {
    const parameters = this.normalizeParameters(input.bodyTextParameters);
    const visibleBody = this.renderSurveyFlowInvitationBody(
      parameters[0],
      parameters[1],
      parameters[2],
    );

    const flowMetadata: TemplateMessageSnapshotFlowMetadata = {
      buttonIndex: input.buttonIndex.trim(),
      ctaLabel: SURVEY_FLOW_INVITATION_CTA_LABEL,
      ...(this.normalizeOptionalValue(input.dispatchId)
        ? { dispatchId: this.normalizeOptionalValue(input.dispatchId)! }
        : {}),
      ...(this.normalizeOptionalValue(input.surveyDateIso)
        ? { surveyDateIso: this.normalizeOptionalValue(input.surveyDateIso)! }
        : {}),
    };

    return this.buildSnapshot({
      templateName: input.templateName,
      templateLanguageCode: input.languageCode,
      templateVariant: 'SURVEY_FLOW_INVITATION',
      visibleBody,
      bodyTextParameters: parameters,
      visibleButtons: [],
      buttonPayloads: [],
      flowMetadata,
      snapshotVersion: TEMPLATE_SNAPSHOT_VERSION,
    });
  }

  private buildSnapshot(input: {
    templateName: string;
    templateLanguageCode: string;
    templateVariant: TemplateMessageSnapshot['templateVariant'];
    visibleBody: string;
    bodyTextParameters: readonly string[];
    visibleButtons: readonly TemplateMessageSnapshotButton[];
    buttonPayloads: readonly TemplateMessageSnapshotButtonPayload[];
    flowMetadata?: TemplateMessageSnapshotFlowMetadata;
    snapshotVersion: string;
  }): TemplateMessageSnapshot {
    const snapshotForHash: TemplateSnapshotCore = {
      templateName: input.templateName,
      templateLanguageCode: input.templateLanguageCode,
      templateVariant: input.templateVariant,
      visibleBody: input.visibleBody,
      bodyTextParameters: input.bodyTextParameters,
      visibleButtons: input.visibleButtons,
      buttonPayloads: input.buttonPayloads,
      flowMetadata: input.flowMetadata,
      snapshotVersion: input.snapshotVersion,
    };

    return {
      templateName: snapshotForHash.templateName,
      templateLanguageCode: snapshotForHash.templateLanguageCode,
      templateVariant: snapshotForHash.templateVariant,
      visibleBody: snapshotForHash.visibleBody,
      bodyTextParameters: snapshotForHash.bodyTextParameters,
      visibleButtons: snapshotForHash.visibleButtons,
      buttonPayloads: snapshotForHash.buttonPayloads,
      flowMetadata: snapshotForHash.flowMetadata,
      snapshotVersion: snapshotForHash.snapshotVersion,
      renderedHash: this.hashSnapshot(this.buildHashInput(snapshotForHash)),
    };
  }

  private buildHashInput(
    snapshot: TemplateSnapshotCore,
  ): TemplateSnapshotHashInput {
    return {
      templateName: snapshot.templateName,
      templateLanguageCode: snapshot.templateLanguageCode,
      templateVariant: snapshot.templateVariant,
      visibleBody: snapshot.visibleBody,
      visibleButtons: snapshot.visibleButtons,
      snapshotVersion: snapshot.snapshotVersion,
      flowMetadata: snapshot.flowMetadata?.ctaLabel
        ? { ctaLabel: snapshot.flowMetadata.ctaLabel }
        : null,
    };
  }

  private renderAppointmentReminderBody(parameters: readonly string[]): string {
    const patientName = this.resolveText(parameters[0], 'Paciente');
    const specialtyName = this.resolveText(
      parameters[1],
      'Consulta medica',
    );
    const modality = this.resolveText(parameters[2], '');
    const day = this.resolveText(parameters[3], '');
    const hour = this.resolveText(parameters[4], '');
    const city = this.resolveText(parameters[5], '');
    const address = this.resolveText(parameters[6], '');
    const doctorName = this.resolveText(parameters[7], '');

    return [
      `Hola ${patientName}. Te recordamos tu cita en IPS SISM:`,
      '',
      `🩺 Tipo de cita: ${specialtyName}`,
      `⚕️ Modalidad: ${modality}`,
      `📅 Fecha: ${day}`,
      `⏰ Hora: ${hour}`,
      `🌆 Ciudad: ${city}`,
      `🧭 Dirección: ${address}`,
      `👨‍⚕️ Profesional: ${doctorName}`,
      '',
      '❗ Recuerda llegar 15 minutos antes para activar tu cita y evitar retrasos en tu atención.',
    ]
      .join('\n')
      .trim();
  }

  private renderSurveyPhoneVerificationBody(
    patientShortName: string | undefined,
  ): string {
    const resolvedShortName = this.resolveText(patientShortName, 'Paciente');

    return [
      `👋 Hola ${resolvedShortName}. Somos IPS SISM.`,
      '',
      'Confirma si este numero celular te pertenece o si estas autorizado(a) para recibir recordatorios de citas, encuestas de satisfaccion y notificaciones importantes sobre servicios de salud de este paciente.',
      '',
      'Por proteccion de tus datos, no enviaremos informacion de citas hasta confirmar este contacto.',
      '',
      'Selecciona una opcion:',
    ]
      .join('\n')
      .trim();
  }

  private renderSurveyFlowInvitationBody(
    patientName: string | undefined,
    specialtyName: string | undefined,
    appointmentHour: string | undefined,
  ): string {
    const resolvedPatientName = this.resolveText(patientName, 'Paciente');
    const resolvedSpecialtyName = this.resolveText(
      specialtyName,
      'la especialidad asignada',
    );
    const resolvedAppointmentHour = this.resolveText(
      appointmentHour,
      'la hora asignada',
    );

    return [
      `Hola *${resolvedPatientName}*! Tu opinion es muy valiosa para nosotros y queremos mejorar para ti. Como 🏥 *IPS SISM* nos gustaria conocer tu experiencia en la atencion de tu cita de 🩺 *${resolvedSpecialtyName}* a las *${resolvedAppointmentHour}*.`,
      '',
      'Selecciona el boton para responder la breve encuesta.',
    ]
      .join('\n')
      .trim();
  }

  private normalizeParameters(parameters: readonly string[]): readonly string[] {
    return parameters.map((value) => this.normalizeValue(value));
  }

  private normalizeValue(value: string): string {
    return value.replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
  }

  private resolveText(value: string | undefined, fallback: string): string {
    const normalized = this.normalizeValue(value ?? '');
    return normalized.length > 0 ? normalized : fallback;
  }

  private normalizeOptionalValue(value: string | undefined): string | undefined {
    if (value === undefined) {
      return undefined;
    }

    const normalized = this.normalizeValue(value);
    return normalized.length > 0 ? normalized : undefined;
  }

  private hashSnapshot(snapshot: TemplateSnapshotHashInput): string {
    return createHash('sha256').update(JSON.stringify(snapshot)).digest('hex');
  }
}
