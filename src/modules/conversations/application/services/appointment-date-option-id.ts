const APPOINTMENT_DATE_OPTION_PREFIX = 'appointment_date:';

export function buildAppointmentDateOptionId(dateIso: string): string {
  return `${APPOINTMENT_DATE_OPTION_PREFIX}${dateIso}`;
}

export function parseAppointmentDateOptionId(optionId: string): string | null {
  if (!optionId.startsWith(APPOINTMENT_DATE_OPTION_PREFIX)) {
    return null;
  }

  const dateIso = optionId.slice(APPOINTMENT_DATE_OPTION_PREFIX.length).trim();
  if (!dateIso) {
    return null;
  }

  return dateIso;
}
