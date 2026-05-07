import { AssignedAppointmentConsultationDetailsMessageFactory } from './assigned-appointment-consultation-details-message.factory';

describe('AssignedAppointmentConsultationDetailsMessageFactory', () => {
  it('builds consultation details message with back, main menu and finish buttons', () => {
    const factory = new AssignedAppointmentConsultationDetailsMessageFactory();

    const message = factory.build({
      patientFullName: 'DANIEL CASTANO',
      specialtyName: 'MEDICINA GENERAL',
      professionalName: 'TIBURCIO MANJARREZ',
      siteName: 'Sede Central',
      siteAddress: 'Calle 1 # 2-3',
      appointmentDateIso: '2026-01-30',
      appointmentDisplayTime: '03:00 PM',
    });

    expect(message.type).toBe('interactive_buttons');
    expect(message.body).toContain('Señor(a) DANIEL CASTANO');
    expect(message.body).toContain('🩺Especialidad: MEDICINA GENERAL');
    expect(message.buttons).toEqual([
      {
        id: 'nav_back',
        title: 'Volver',
      },
      {
        id: 'nav_main_menu',
        title: 'Menu principal',
      },
      {
        id: 'nav_finish',
        title: 'Finalizar',
      },
    ]);
  });
});
