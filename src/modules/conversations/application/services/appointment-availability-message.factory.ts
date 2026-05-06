import { Injectable } from '@nestjs/common';
import type { ConversationOutboundInteractiveButtonsMessage } from '../../domain/value-objects/conversation-outbound-message';
import { NAVIGATION_OPTION_IDS } from './conversation-navigation.service';

@Injectable()
export class AppointmentAvailabilityMessageFactory {
  buildNoAvailability(): ConversationOutboundInteractiveButtonsMessage {
    return {
      type: 'interactive_buttons',
      body: 'En este momento no hay citas disponible para esta especialidad. Pronto habran mas citas disponibles para esta especialidad',
      buttons: [
        { id: NAVIGATION_OPTION_IDS.MAIN_MENU, title: 'Menu principal' },
        { id: NAVIGATION_OPTION_IDS.FINISH, title: 'Finalizar' },
      ],
    };
  }

  buildTechnicalFailure(): ConversationOutboundInteractiveButtonsMessage {
    return {
      type: 'interactive_buttons',
      body: 'En este momento no podemos consultar la agenda de esta especialidad. Intenta nuevamente en unos minutos desde el menu principal.',
      buttons: [
        { id: NAVIGATION_OPTION_IDS.MAIN_MENU, title: 'Menu principal' },
        { id: NAVIGATION_OPTION_IDS.FINISH, title: 'Finalizar' },
      ],
    };
  }

  buildNoTimeAvailabilityForSelectedDate(displayDate: string): string {
    return `No encontramos horas disponibles para el dia ${displayDate}. Selecciona otro dia para continuar.`;
  }

  buildNoMoreTimesForSelectedDate(): string {
    return 'No hay mas horas disponibles para esta fecha. Selecciona una de las horas mostradas para continuar.';
  }
}
