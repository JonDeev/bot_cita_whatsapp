import { AppointmentReminderDispatchContactDecisionService } from './appointment-reminder-dispatch-contact-decision.service';

describe('AppointmentReminderDispatchContactDecisionService', () => {
  const service = new AppointmentReminderDispatchContactDecisionService();

  it('returns reminder when the phone is valid and opt-in exists', () => {
    expect(
      service.resolve({
        recipientPhoneE164: '573001234567',
        hasAppointmentNotificationsOptIn: true,
        suppressionDecision: { kind: 'ALLOW_CONTACT' },
      }),
    ).toEqual({
      kind: 'SEND_REMINDER',
      recipientPhoneE164: '573001234567',
    });
  });

  it('returns verification when the phone is valid and opt-in is missing', () => {
    expect(
      service.resolve({
        recipientPhoneE164: '573001234567',
        hasAppointmentNotificationsOptIn: false,
        suppressionDecision: { kind: 'ALLOW_CONTACT' },
      }),
    ).toEqual({
      kind: 'SEND_PHONE_VERIFICATION',
      recipientPhoneE164: '573001234567',
    });
  });

  it('returns suppression skip when contact is actively suppressed', () => {
    expect(
      service.resolve({
        recipientPhoneE164: '573001234567',
        hasAppointmentNotificationsOptIn: true,
        suppressionDecision: {
          kind: 'BLOCK_SUPPRESSED_CONTACT',
          reason: 'UNKNOWN_PERSON',
        },
      }),
    ).toEqual({
      kind: 'SKIP_SUPPRESSED_CONTACT',
      suppressionReason: 'UNKNOWN_PERSON',
    });
  });

  it('returns invalid-phone skip when suppression policy blocks the contact as invalid', () => {
    expect(
      service.resolve({
        recipientPhoneE164: '573001234567',
        hasAppointmentNotificationsOptIn: true,
        suppressionDecision: {
          kind: 'BLOCK_INVALID_PHONE',
        },
      }),
    ).toEqual({
      kind: 'SKIP_INVALID_PHONE',
    });
  });
});
