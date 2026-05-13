import {
  APPOINTMENT_TIME_SHOW_MORE_OPTION_ID,
  buildAppointmentTimeOptionId,
  parseAppointmentTimeOptionId,
} from './appointment-time-option-id';

describe('appointment-time-option-id', () => {
  it('parses slot option ids', () => {
    expect(
      parseAppointmentTimeOptionId(buildAppointmentTimeOptionId('101')),
    ).toEqual({
      kind: 'slot',
      slotRef: '101',
    });
  });

  it('parses show more option id', () => {
    expect(
      parseAppointmentTimeOptionId(APPOINTMENT_TIME_SHOW_MORE_OPTION_ID),
    ).toEqual({
      kind: 'show_more',
    });
  });
});
