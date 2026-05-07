import { AssignedAppointmentDetailsMessageFactory } from './assigned-appointment-details-message.factory';

describe('AssignedAppointmentDetailsMessageFactory', () => {
  it('builds the expected details message with action buttons', () => {
    const factory = new AssignedAppointmentDetailsMessageFactory();

    const message = factory.build({
      patientFullName: 'DANIEL CASTANO',
      specialtyName: 'MEDICINA GENERAL',
      professionalName: 'TIBURCIO MANJARREZ',
      appointmentDateIso: '2026-01-30',
      appointmentDisplayTime: '03:00 PM',
    });

    expect(message.type).toBe('interactive_buttons');
    expect(message.body).toContain('Señor(a) DANIEL CASTANO');
    expect(message.body).toContain('🩺Tipo de cita: MEDICINA GENERAL');
    expect(message.buttons).toEqual([
      {
        id: 'assigned_appointment_action:reprogram',
        title: 'Reprogramar',
      },
      {
        id: 'assigned_appointment_action:cancel',
        title: 'Cancelar',
      },
    ]);
  });
});
