import {
  ASSIGNED_APPOINTMENT_ACTION_OPTION_IDS,
  isAssignedAppointmentActionOptionId,
} from './assigned-appointment-action-option-id';

describe('assigned appointment action option ids', () => {
  it('recognizes valid action option ids', () => {
    expect(
      isAssignedAppointmentActionOptionId(
        ASSIGNED_APPOINTMENT_ACTION_OPTION_IDS.REPROGRAM,
      ),
    ).toBe(true);
    expect(
      isAssignedAppointmentActionOptionId(
        ASSIGNED_APPOINTMENT_ACTION_OPTION_IDS.CANCEL,
      ),
    ).toBe(true);
  });

  it('returns false for unknown action option ids', () => {
    expect(isAssignedAppointmentActionOptionId('unknown')).toBe(false);
  });
});
