import { AppointmentDoctorListPresenterService } from './appointment-doctor-list-presenter.service';

describe('AppointmentDoctorListPresenterService', () => {
  const service = new AppointmentDoctorListPresenterService();

  it('keeps short names in title without description', () => {
    expect(service.present('ANA GARCIA')).toEqual({
      title: 'ANA GARCIA',
    });
  });

  it('uses first and last name for long names and keeps full name as description', () => {
    expect(service.present('DANIELA MERCEDES FONSECA FONSECA')).toEqual({
      title: 'DANIELA FONSECA',
      description: 'DANIELA MERCEDES FONSECA FONSECA',
    });
  });

  it('truncates very long single-token names safely', () => {
    const result = service.present('ABCDEFGHIJKLMNOPQRSTUVWXYZABCDE');
    expect(result.title.length).toBeLessThanOrEqual(24);
    expect(result.description?.length).toBeLessThanOrEqual(72);
  });
});
