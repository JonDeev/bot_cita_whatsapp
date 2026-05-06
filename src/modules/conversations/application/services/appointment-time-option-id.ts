const APPOINTMENT_TIME_OPTION_PREFIX = 'appointment_time:';
export const APPOINTMENT_TIME_SHOW_MORE_OPTION_ID = `${APPOINTMENT_TIME_OPTION_PREFIX}show_more`;

export type ParsedAppointmentTimeOption =
  | {
      kind: 'slot';
      slotRef: string;
    }
  | {
      kind: 'show_more';
    };

export function buildAppointmentTimeOptionId(slotRef: string): string {
  return `${APPOINTMENT_TIME_OPTION_PREFIX}${slotRef}`;
}

export function parseAppointmentTimeOptionId(optionId: string): ParsedAppointmentTimeOption | null {
  if (optionId === APPOINTMENT_TIME_SHOW_MORE_OPTION_ID) {
    return { kind: 'show_more' };
  }

  if (!optionId.startsWith(APPOINTMENT_TIME_OPTION_PREFIX)) {
    return null;
  }

  const slotRef = optionId.slice(APPOINTMENT_TIME_OPTION_PREFIX.length).trim();
  if (!slotRef || slotRef === 'show_more') {
    return null;
  }

  return {
    kind: 'slot',
    slotRef,
  };
}
