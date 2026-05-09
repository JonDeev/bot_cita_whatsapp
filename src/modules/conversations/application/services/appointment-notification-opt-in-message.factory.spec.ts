import { AppointmentNotificationOptInMessageFactory } from './appointment-notification-opt-in-message.factory';

describe('AppointmentNotificationOptInMessageFactory', () => {
  it('builds an interactive consent prompt with accept and decline buttons', () => {
    const factory = new AppointmentNotificationOptInMessageFactory();
    const message = factory.build();

    expect(message).toMatchObject({
      type: 'interactive_buttons',
      buttons: [
        {
          id: 'appointment_notifications_opt_in:accept',
          title: 'Si autorizo',
        },
        {
          id: 'appointment_notifications_opt_in:decline',
          title: 'No autorizo',
        },
      ],
    });
    expect(message.body).toContain('recordatorios');
    expect(message.body).toContain('encuestas de satisfaccion');
  });
});
