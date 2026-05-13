import { AssignedAppointmentListFactory } from './assigned-appointment-list.factory';

describe('AssignedAppointmentListFactory', () => {
  it('builds list rows and appends show more row when hasMore is true', () => {
    const factory = new AssignedAppointmentListFactory();

    const message = factory.build(
      [
        {
          slotRef: '101',
          specialtyName: 'MEDICINA GENERAL',
          appointmentDateIso: '2026-05-30',
          appointmentDisplayTime: '11:40 AM',
        },
      ],
      true,
    );

    expect(message).toEqual({
      type: 'interactive_list',
      body: 'Selecciona la cita que deseas mover o cancelar.',
      buttonText: 'Ver citas',
      sections: [
        {
          title: 'Citas asignadas',
          rows: [
            {
              id: 'assigned_appointment:101',
              title: 'MEDICINA GENERAL',
              description: '2026-05-30 11:40 AM',
            },
            {
              id: 'assigned_appointment:show_more',
              title: 'Ver mas citas',
              description: 'Consultar mas citas asignadas',
            },
          ],
        },
      ],
    });
  });

  it('builds consultation copy when mode is check appointments', () => {
    const factory = new AssignedAppointmentListFactory();

    const message = factory.build(
      [
        {
          slotRef: '101',
          specialtyName: 'MEDICINA GENERAL',
          appointmentDateIso: '2026-05-30',
          appointmentDisplayTime: '11:40 AM',
        },
      ],
      false,
      {
        mode: 'CHECK_APPOINTMENTS',
        patientFullName: 'DANIEL CASTANO',
      },
    );

    expect(message.body).toBe(
      'Hola DANIEL CASTANO Estas son tus citas agendadas',
    );
    expect(message.sections[0].rows).toHaveLength(1);
  });
});
