export const APPOINTMENT_NOTIFICATION_OPT_IN_OPTION_IDS = {
  ACCEPT: 'appointment_notifications_opt_in:accept',
  DECLINE: 'appointment_notifications_opt_in:decline',
} as const;

export type AppointmentNotificationOptInOptionId =
  (typeof APPOINTMENT_NOTIFICATION_OPT_IN_OPTION_IDS)[keyof typeof APPOINTMENT_NOTIFICATION_OPT_IN_OPTION_IDS];

export function isAppointmentNotificationOptInOptionId(
  value: string | undefined | null,
): value is AppointmentNotificationOptInOptionId {
  if (!value) {
    return false;
  }

  return Object.values(APPOINTMENT_NOTIFICATION_OPT_IN_OPTION_IDS).includes(
    value as AppointmentNotificationOptInOptionId,
  );
}
