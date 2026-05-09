import {
  APPOINTMENT_NOTIFICATION_OPT_IN_OPTION_IDS,
  isAppointmentNotificationOptInOptionId,
} from './appointment-notification-opt-in-option-id';

describe('appointment-notification-opt-in-option-id', () => {
  it('recognizes valid option ids', () => {
    expect(
      isAppointmentNotificationOptInOptionId(
        APPOINTMENT_NOTIFICATION_OPT_IN_OPTION_IDS.ACCEPT,
      ),
    ).toBe(true);
    expect(
      isAppointmentNotificationOptInOptionId(
        APPOINTMENT_NOTIFICATION_OPT_IN_OPTION_IDS.DECLINE,
      ),
    ).toBe(true);
  });

  it('returns false for unknown option ids', () => {
    expect(isAppointmentNotificationOptInOptionId('unknown')).toBe(false);
  });
});
