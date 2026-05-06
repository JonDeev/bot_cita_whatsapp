import { AppointmentAvailabilityCutoffService } from './appointment-availability-cutoff.service';

describe('AppointmentAvailabilityCutoffService', () => {
  it('builds the bogota cutoff from now plus two hours', () => {
    const service = new AppointmentAvailabilityCutoffService();

    const cutoff = service.build(new Date('2026-05-05T15:39:00.000Z'));

    expect(cutoff).toEqual({
      cutoffDateIso: '2026-05-05',
      cutoffTimeHHmm: '12:39',
    });
  });
});
