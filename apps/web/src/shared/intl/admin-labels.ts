const MACHINE_CODE_PATTERN = /^[A-Z0-9_.-]+$/;

const conversationStatusLabels: Record<string, string> = {
  BOT_ACTIVE: 'Bot activo',
  HUMAN_HANDOFF: 'Atencion humana',
  CLOSED: 'Cerrada',
  EXPIRED: 'Expirada',
};

const conversationStateLabels: Record<string, string> = {
  MAIN_MENU: 'Menu principal',
  WAITING_DOCUMENT: 'Esperando documento',
  WAITING_BIRTH_DATE: 'Esperando fecha de nacimiento',
  PATIENT_VALIDATED: 'Paciente validado',
  CONFIRMING_PATIENT_CONTACT: 'Confirmando contacto del paciente',
  SELECTING_CONTACT_UPDATE_FIELD: 'Seleccionando campo de contacto',
  UPDATING_CONTACT_PHONE: 'Actualizando telefono',
  UPDATING_CONTACT_EMAIL: 'Actualizando correo',
  SELECTING_ASSIGNED_APPOINTMENT: 'Seleccionando cita asignada',
  REVIEWING_ASSIGNED_APPOINTMENT_ACTIONS: 'Revisando acciones de cita',
  REVIEWING_ASSIGNED_APPOINTMENT_DETAILS: 'Revisando detalle de cita',
  SELECTING_SPECIALTY: 'Seleccionando especialidad',
  SELECTING_APPOINTMENT_DATE: 'Seleccionando fecha de cita',
  SELECTING_APPOINTMENT_DOCTOR: 'Seleccionando medico',
  SELECTING_APPOINTMENT_TIME: 'Seleccionando hora de cita',
  REQUESTING_WHATSAPP_APPOINTMENT_NOTIFICATIONS_OPT_IN:
    'Solicitando autorizacion de notificaciones',
};

const messageDirectionLabels: Record<string, string> = {
  INBOUND: 'Entrante',
  OUTBOUND: 'Saliente',
};

const messageTypeLabels: Record<string, string> = {
  text: 'Texto',
  interactive: 'Interactivo',
  template: 'Plantilla',
  image: 'Imagen',
  document: 'Documento',
  audio: 'Audio',
  video: 'Video',
  sticker: 'Sticker',
  location: 'Ubicacion',
  contacts: 'Contactos',
  button: 'Boton',
};

const reminderDispatchStatusLabels: Record<string, string> = {
  PENDING: 'Pendiente',
  LOCKED: 'Bloqueado',
  PHONE_VERIFICATION_PENDING: 'Pendiente verificacion de telefono',
  PHONE_VERIFICATION_EXPIRED: 'Verificacion de telefono expirada',
  SENT: 'Enviado',
  SKIPPED_NO_OPT_IN: 'Omitido sin autorizacion',
  SKIPPED_INVALID_PHONE: 'Omitido por telefono invalido',
  SKIPPED_APPOINTMENT_CANCELLED: 'Omitido por cita cancelada',
  SKIPPED_APPOINTMENT_RESCHEDULED: 'Omitido por cita reprogramada',
  SKIPPED_LATE_CONFIRMATION: 'Omitido por confirmacion tardia',
  SKIPPED_SUPPRESSED_CONTACT: 'Omitido por contacto bloqueado',
  SKIPPED_HANDOFF_ACTIVE: 'Omitido por atencion humana activa',
  FAILED: 'Fallido',
};

const reminderTypeLabels: Record<string, string> = {
  APPOINTMENT_24H: 'Cita 24 horas antes',
};

const surveyDispatchStatusLabels: Record<string, string> = {
  PENDING: 'Pendiente',
  PHONE_VERIFICATION_PENDING: 'Pendiente verificacion telefonica',
  SENT: 'Enviada',
  STARTED: 'Iniciada',
  COMPLETED: 'Completada',
  DECLINED: 'Declinada',
  EXPIRED: 'Expirada',
  FAILED: 'Fallida',
  CANCELLED_BY_HANDOFF: 'Cancelada por atencion humana',
  BLOCKED_CONTACT: 'Bloqueada por contacto',
};

const surveyTriggerTypeLabels: Record<string, string> = {
  POST_APPOINTMENT_HALF_HOUR_BATCH: 'Post cita (lote de 30 minutos)',
};

const failureSourceLabels: Record<string, string> = {
  OUTBOX: 'Bandeja de salida',
  WEBHOOK: 'Webhook',
};

const liveEventTypeLabels: Record<string, string> = {
  'message.inbound': 'Mensaje entrante',
  'message.outbound': 'Mensaje saliente',
  'outbox.failed': 'Fallo en bandeja de salida',
  'webhook.failed': 'Fallo de webhook',
  'reminder.failed': 'Recordatorio fallido',
  'survey.completed': 'Encuesta completada',
  'system.degraded': 'Sistema degradado',
  heartbeat: 'Latido del sistema',
  'auth.session.revoked': 'Sesion revocada',
};

const adminRoleLabels: Record<string, string> = {
  ADMIN: 'Administrador',
  SUPERVISOR: 'Supervisor',
  ASESOR: 'Asesor',
};

const adminUserStatusLabels: Record<string, string> = {
  ACTIVE: 'Activo',
  DISABLED: 'Deshabilitado',
};

function capitalize(input: string): string {
  if (input.length === 0) {
    return input;
  }
  return `${input[0]!.toUpperCase()}${input.slice(1)}`;
}

function prettifyMachineCode(value: string): string {
  return capitalize(
    value
      .toLowerCase()
      .replace(/[_.-]+/g, ' ')
      .trim(),
  );
}

function labelFromMap(value: string, labels: Record<string, string>): string {
  if (value.length === 0) {
    return '-';
  }

  const mapped = labels[value];
  if (mapped) {
    return mapped;
  }

  if (MACHINE_CODE_PATTERN.test(value)) {
    return prettifyMachineCode(value);
  }

  return value;
}

export function formatConversationStatusLabel(value: string): string {
  return labelFromMap(value, conversationStatusLabels);
}

export function formatConversationStateLabel(value: string): string {
  return labelFromMap(value, conversationStateLabels);
}

export function formatMessageDirectionLabel(value: string): string {
  return labelFromMap(value, messageDirectionLabels);
}

export function formatMessageTypeLabel(value: string): string {
  const normalized = value.toLowerCase();
  return labelFromMap(normalized, messageTypeLabels);
}

export function formatReminderDispatchStatusLabel(value: string): string {
  return labelFromMap(value, reminderDispatchStatusLabels);
}

export function formatReminderTypeLabel(value: string): string {
  return labelFromMap(value, reminderTypeLabels);
}

export function formatSurveyDispatchStatusLabel(value: string): string {
  return labelFromMap(value, surveyDispatchStatusLabels);
}

export function formatSurveyTriggerTypeLabel(value: string): string {
  return labelFromMap(value, surveyTriggerTypeLabels);
}

export function formatFailureSourceLabel(value: string): string {
  return labelFromMap(value, failureSourceLabels);
}

export function formatLiveEventTypeLabel(value: string): string {
  return labelFromMap(value, liveEventTypeLabels);
}

export function formatAdminRoleLabel(value: string): string {
  return labelFromMap(value, adminRoleLabels);
}

export function formatAdminUserStatusLabel(value: string): string {
  return labelFromMap(value, adminUserStatusLabels);
}

export function formatSystemCodeLabel(value: string): string {
  return labelFromMap(value, {});
}

export function formatLiveSummaryLabel(value: string): string {
  return value
    .replace(/\binbound\b/gi, 'entrante')
    .replace(/\boutbound\b/gi, 'saliente')
    .replace(/\btext\b/gi, 'texto')
    .replace(/\binteractive\b/gi, 'interactivo')
    .replace(/\btemplate\b/gi, 'plantilla');
}
