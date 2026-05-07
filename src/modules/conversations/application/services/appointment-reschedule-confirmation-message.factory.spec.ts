import { AppointmentRescheduleConfirmationMessageFactory } from './appointment-reschedule-confirmation-message.factory';

describe('AppointmentRescheduleConfirmationMessageFactory', () => {
  it('builds interactive confirmation message with main menu and finish buttons', () => {
    const factory = new AppointmentRescheduleConfirmationMessageFactory();

    const message = factory.build({
      slotRef: '202',
      specialtyName: 'MEDICINA GENERAL',
      patientFullName: 'DANIEL ANDRES CASTANO NAVARRO',
      appointmentDateIso: '2026-05-30',
      appointmentTimeHHmm: '11:40',
      appointmentDisplayTime: '11:40 AM',
      professionalName: 'MEDICO',
      siteName: 'Santa Marta',
      siteAddress: 'Carrera 19',
      usedFallbackSlot: false,
    });

    expect(message).toMatchObject({
      type: 'interactive_buttons',
      buttons: [
        { id: 'nav_main_menu', title: 'Menu principal' },
        { id: 'nav_finish', title: 'Finalizar' },
      ],
    });
    expect(message.body).toContain('su cita se reprogramo satisfactoriamente');
  });
});
