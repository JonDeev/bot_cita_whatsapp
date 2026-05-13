const APPOINTMENT_DATE_OPTION_PREFIX = 'appointment_date:';
export const APPOINTMENT_DATE_CHOOSE_DOCTOR_OPTION_ID = `${APPOINTMENT_DATE_OPTION_PREFIX}choose_doctor`;

export function buildAppointmentDateOptionId(dateIso: string): string {
  return `${APPOINTMENT_DATE_OPTION_PREFIX}${dateIso}`;
}

export type ParsedAppointmentDateOption =
  | {
      kind: 'date';
      dateIso: string;
    }
  | {
      kind: 'choose_doctor';
    };

export function parseAppointmentDateOptionId(
  optionId: string,
): ParsedAppointmentDateOption | null {
  if (optionId === APPOINTMENT_DATE_CHOOSE_DOCTOR_OPTION_ID) {
    return { kind: 'choose_doctor' };
  }

  if (!optionId.startsWith(APPOINTMENT_DATE_OPTION_PREFIX)) {
    return null;
  }

  const dateIso = optionId.slice(APPOINTMENT_DATE_OPTION_PREFIX.length).trim();
  if (!dateIso || dateIso === 'choose_doctor') {
    return null;
  }

  return {
    kind: 'date',
    dateIso,
  };
}
