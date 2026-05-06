import { AppointmentTimePresenterService } from './appointment-time-presenter.service';

describe('AppointmentTimePresenterService', () => {
  it('formats morning and afternoon times with AM/PM', () => {
    const service = new AppointmentTimePresenterService();

    expect(service.formatHHmmAsTwelveHour('08:30')).toBe('08:30 AM');
    expect(service.formatHHmmAsTwelveHour('13:45')).toBe('01:45 PM');
  });

  it('formats noon and midnight boundaries correctly', () => {
    const service = new AppointmentTimePresenterService();

    expect(service.formatHHmmAsTwelveHour('12:00')).toBe('12:00 PM');
    expect(service.formatHHmmAsTwelveHour('00:00')).toBe('12:00 AM');
  });

  it('returns the original value when time format is invalid', () => {
    const service = new AppointmentTimePresenterService();

    expect(service.formatHHmmAsTwelveHour('8:00')).toBe('8:00');
  });
});
