import { AppointmentAvailabilityMessageFactory } from './appointment-availability-message.factory';
import { NO_AVAILABILITY_OPTION_IDS } from './no-availability-option-id';

describe('AppointmentAvailabilityMessageFactory', () => {
  it('builds no-availability buttons with back to specialties option', () => {
    const factory = new AppointmentAvailabilityMessageFactory();

    const message = factory.buildNoAvailability();

    expect(message).toEqual({
      type: 'interactive_buttons',
      body: 'Disculpenos en este momento no hay citas disponibles para esta especialidad. Intente mas tarde',
      buttons: [
        { id: NO_AVAILABILITY_OPTION_IDS.BACK_TO_SPECIALTIES, title: 'Volver' },
        { id: 'nav_main_menu', title: 'Menu principal' },
        { id: 'nav_finish', title: 'Finalizar' },
      ],
    });
  });
});

