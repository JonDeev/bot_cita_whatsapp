import {
  ASSIGNED_APPOINTMENT_SHOW_MORE_OPTION_ID,
  buildAssignedAppointmentOptionId,
  parseAssignedAppointmentOptionId,
} from './assigned-appointment-option-id';

describe('assigned appointment option id helpers', () => {
  it('builds and parses slot option ids', () => {
    const optionId = buildAssignedAppointmentOptionId('101');

    expect(optionId).toBe('assigned_appointment:101');
    expect(parseAssignedAppointmentOptionId(optionId)).toEqual({
      kind: 'slot',
      slotRef: '101',
    });
  });

  it('parses show more option id', () => {
    expect(parseAssignedAppointmentOptionId(ASSIGNED_APPOINTMENT_SHOW_MORE_OPTION_ID)).toEqual({
      kind: 'show_more',
    });
  });
});
