import {
  APPOINTMENT_DATE_CHOOSE_DOCTOR_OPTION_ID,
  parseAppointmentDateOptionId,
} from './appointment-date-option-id';

describe('appointment-date-option-id', () => {
  it('parses regular date selections', () => {
    expect(parseAppointmentDateOptionId('appointment_date:2026-05-06')).toEqual(
      {
        kind: 'date',
        dateIso: '2026-05-06',
      },
    );
  });

  it('parses choose doctor selection', () => {
    expect(
      parseAppointmentDateOptionId(APPOINTMENT_DATE_CHOOSE_DOCTOR_OPTION_ID),
    ).toEqual({
      kind: 'choose_doctor',
    });
  });
});
