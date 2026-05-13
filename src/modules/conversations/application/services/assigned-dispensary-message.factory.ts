import { Injectable } from '@nestjs/common';
import { NAVIGATION_OPTION_IDS } from './conversation-navigation.service';
import type { ConversationOutboundInteractiveButtonsMessage } from '../../domain/value-objects/conversation-outbound-message';

interface BuildAssignedDispensaryMessageInput {
  patientFullName: string;
  dispensaryName: string;
  dispensaryAddress: string;
  dispensaryCity: string;
  dispensarySchedule: string;
}

@Injectable()
export class AssignedDispensaryMessageFactory {
  buildAssigned(
    input: BuildAssignedDispensaryMessageInput,
  ): ConversationOutboundInteractiveButtonsMessage {
    return {
      type: 'interactive_buttons',
      body: [
        `Hola ${input.patientFullName}. Tu farmacia asignada es:`,
        '',
        `💊Nombre: ${input.dispensaryName}`,
        `🏠Direccion: ${input.dispensaryAddress}`,
        `🌆Ciudad: ${input.dispensaryCity}`,
        `🕜Horario: ${input.dispensarySchedule}`,
      ].join('\n'),
      buttons: [
        {
          id: NAVIGATION_OPTION_IDS.MAIN_MENU,
          title: 'Menu principal',
        },
        {
          id: NAVIGATION_OPTION_IDS.FINISH,
          title: 'Finalizar',
        },
      ],
    };
  }

  buildNotAssigned(
    patientFullName: string,
  ): ConversationOutboundInteractiveButtonsMessage {
    return {
      type: 'interactive_buttons',
      body: `hola ${patientFullName}, no tenemos informacion de tu dispensario asignado aun comunicate con tu EPS`,
      buttons: [
        {
          id: NAVIGATION_OPTION_IDS.MAIN_MENU,
          title: 'Menu principal',
        },
        {
          id: NAVIGATION_OPTION_IDS.FINISH,
          title: 'Finalizar',
        },
      ],
    };
  }

  buildTechnicalFailure(): ConversationOutboundInteractiveButtonsMessage {
    return {
      type: 'interactive_buttons',
      body: 'En este momento no pudimos consultar la informacion de tu dispensario asignado. Intenta nuevamente en unos minutos.',
      buttons: [
        {
          id: NAVIGATION_OPTION_IDS.MAIN_MENU,
          title: 'Menu principal',
        },
        {
          id: NAVIGATION_OPTION_IDS.FINISH,
          title: 'Finalizar',
        },
      ],
    };
  }
}
