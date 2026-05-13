const ASSIGNED_APPOINTMENT_OPTION_PREFIX = 'assigned_appointment:';
export const ASSIGNED_APPOINTMENT_SHOW_MORE_OPTION_ID = `${ASSIGNED_APPOINTMENT_OPTION_PREFIX}show_more`;

export type ParsedAssignedAppointmentOption =
  | {
      kind: 'slot';
      slotRef: string;
    }
  | {
      kind: 'show_more';
    };

export function buildAssignedAppointmentOptionId(slotRef: string): string {
  return `${ASSIGNED_APPOINTMENT_OPTION_PREFIX}${slotRef}`;
}

export function parseAssignedAppointmentOptionId(
  optionId: string,
): ParsedAssignedAppointmentOption | null {
  if (optionId === ASSIGNED_APPOINTMENT_SHOW_MORE_OPTION_ID) {
    return { kind: 'show_more' };
  }

  if (!optionId.startsWith(ASSIGNED_APPOINTMENT_OPTION_PREFIX)) {
    return null;
  }

  const slotRef = optionId
    .slice(ASSIGNED_APPOINTMENT_OPTION_PREFIX.length)
    .trim();
  if (!slotRef || slotRef === 'show_more') {
    return null;
  }

  return {
    kind: 'slot',
    slotRef,
  };
}
