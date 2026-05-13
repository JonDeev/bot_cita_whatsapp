import { AppointmentTimeListFactory } from './appointment-time-list.factory';

describe('AppointmentTimeListFactory', () => {
  it('builds an interactive list with the provided AM/PM times', () => {
    const factory = new AppointmentTimeListFactory();

    expect(
      factory.build(
        [
          { slotRef: '101', displayTime: '08:30 AM' },
          { slotRef: '102', displayTime: '01:45 PM' },
        ],
        false,
      ),
    ).toEqual({
      type: 'interactive_list',
      body: 'Selecciona la hora de la cita',
      buttonText: 'Ver horas',
      sections: [
        {
          title: 'Horas disponibles',
          rows: [
            { id: 'appointment_time:101', title: '08:30 AM' },
            { id: 'appointment_time:102', title: '01:45 PM' },
          ],
        },
      ],
    });
  });

  it('adds show more row as the tenth option when has more times', () => {
    const factory = new AppointmentTimeListFactory();

    expect(
      factory.build([{ slotRef: '101', displayTime: '08:30 AM' }], true),
    ).toEqual({
      type: 'interactive_list',
      body: 'Selecciona la hora de la cita',
      buttonText: 'Ver horas',
      sections: [
        {
          title: 'Horas disponibles',
          rows: [
            { id: 'appointment_time:101', title: '08:30 AM' },
            { id: 'appointment_time:show_more', title: 'Mostrar mas' },
          ],
        },
      ],
    });
  });

  it('keeps list within WhatsApp limit: nine hours plus show more', () => {
    const factory = new AppointmentTimeListFactory();

    const result = factory.build(
      [
        { slotRef: '1', displayTime: '01:00 AM' },
        { slotRef: '2', displayTime: '02:00 AM' },
        { slotRef: '3', displayTime: '03:00 AM' },
        { slotRef: '4', displayTime: '04:00 AM' },
        { slotRef: '5', displayTime: '05:00 AM' },
        { slotRef: '6', displayTime: '06:00 AM' },
        { slotRef: '7', displayTime: '07:00 AM' },
        { slotRef: '8', displayTime: '08:00 AM' },
        { slotRef: '9', displayTime: '09:00 AM' },
        { slotRef: '10', displayTime: '10:00 AM' },
      ],
      true,
    );

    expect(result.sections[0].rows).toHaveLength(10);
    expect(result.sections[0].rows.at(-1)).toEqual({
      id: 'appointment_time:show_more',
      title: 'Mostrar mas',
    });
  });
});
