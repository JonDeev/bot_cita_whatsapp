export const ASSIGNED_APPOINTMENT_ACTION_OPTION_IDS = {
  REPROGRAM: 'assigned_appointment_action:reprogram',
  CANCEL: 'assigned_appointment_action:cancel',
} as const;

export type AssignedAppointmentActionOptionId =
  (typeof ASSIGNED_APPOINTMENT_ACTION_OPTION_IDS)[keyof typeof ASSIGNED_APPOINTMENT_ACTION_OPTION_IDS];

export function isAssignedAppointmentActionOptionId(
  optionId: string | undefined | null,
): optionId is AssignedAppointmentActionOptionId {
  if (!optionId) {
    return false;
  }

  return Object.values(ASSIGNED_APPOINTMENT_ACTION_OPTION_IDS).includes(
    optionId as AssignedAppointmentActionOptionId,
  );
}
