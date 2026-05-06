import { AppointmentAssignmentConfirmationMessageFactory } from './appointment-assignment-confirmation-message.factory';

describe('AppointmentAssignmentConfirmationMessageFactory', () => {
  it('builds the expected confirmation message', () => {
    const factory = new AppointmentAssignmentConfirmationMessageFactory();

    const message = factory.build({
      slotRef: '101',
      specialtyName: 'MEDICINA GENERAL',
      patientFullName: 'DANIEL ANDRES CASTANO NAVARRO',
      appointmentDateIso: '2026-04-30',
      appointmentTimeHHmm: '11:40',
      appointmentDisplayTime: '11:40 AM',
      professionalName: 'ALICAN MARIA ZAMBRANO PIZARRO',
      siteName: 'Santa Marta',
      siteAddress: 'Carrera 19 No. 26B - 53 Barrio Los Naranjos',
      usedFallbackSlot: false,
    });

    expect(message.body).toContain('Señor(a) DANIEL ANDRES CASTANO NAVARRO');
    expect(message.body).toContain('🩺Especialidad: MEDICINA GENERAL');
    expect(message.body).toContain('🕜Hora: 11:40 AM');
    expect(message.body).toContain('🏙️Sede: Santa Marta.');
    expect(message.buttons).toEqual([
      { id: 'nav_main_menu', title: 'Menu principal' },
      { id: 'nav_finish', title: 'Finalizar' },
    ]);
  });
});
