import { AppointmentDoctorListFactory } from './appointment-doctor-list.factory';
import { AppointmentDoctorListPresenterService } from './appointment-doctor-list-presenter.service';

describe('AppointmentDoctorListFactory', () => {
  it('builds interactive rows for available doctors', () => {
    const factory = new AppointmentDoctorListFactory(
      new AppointmentDoctorListPresenterService(),
    );

    const message = factory.build([
      { employeeCode: 'M001', displayName: 'ANA GARCIA' },
      { employeeCode: 'M002', displayName: 'LUIS PEREZ' },
    ]);

    expect(message).toEqual({
      type: 'interactive_list',
      body: 'Selecciona el medico con quien deseas agendar.',
      buttonText: 'Ver medicos',
      sections: [
        {
          title: 'Medicos disponibles',
          rows: [
            { id: 'appointment_doctor:M001', title: 'ANA GARCIA' },
            { id: 'appointment_doctor:M002', title: 'LUIS PEREZ' },
          ],
        },
      ],
    });
  });

  it('formats long doctor names into safe title + description', () => {
    const factory = new AppointmentDoctorListFactory(
      new AppointmentDoctorListPresenterService(),
    );

    const message = factory.build([
      {
        employeeCode: 'M003',
        displayName: 'DANIELA MERCEDES FONSECA FONSECA',
      },
    ]);

    expect(message.sections[0]?.rows).toEqual([
      {
        id: 'appointment_doctor:M003',
        title: 'DANIELA FONSECA',
        description: 'DANIELA MERCEDES FONSECA FONSECA',
      },
    ]);
  });
});
