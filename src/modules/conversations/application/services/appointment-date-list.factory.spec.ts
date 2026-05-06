import { AppointmentDateListFactory } from './appointment-date-list.factory';

describe('AppointmentDateListFactory', () => {
  it('builds interactive rows using the iso date option id', () => {
    const factory = new AppointmentDateListFactory();

    const message = factory.build([
      { isoDate: '2026-05-06', displayDate: '06/05/2026' },
      { isoDate: '2026-05-07', displayDate: '07/05/2026' },
    ]);

    expect(message).toEqual({
      type: 'interactive_list',
      body: 'Selecciona el dia de la cita',
      buttonText: 'Ver fechas',
      sections: [
        {
          title: 'Dias disponibles',
          rows: [
            { id: 'appointment_date:2026-05-06', title: '06/05/2026' },
            { id: 'appointment_date:2026-05-07', title: '07/05/2026' },
          ],
        },
      ],
    });
  });
});
