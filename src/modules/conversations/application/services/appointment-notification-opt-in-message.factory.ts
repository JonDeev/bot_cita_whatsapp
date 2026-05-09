import { Injectable } from '@nestjs/common';
import type { ConversationOutboundInteractiveButtonsMessage } from '../../domain/value-objects/conversation-outbound-message';
import { APPOINTMENT_NOTIFICATION_OPT_IN_OPTION_IDS } from './appointment-notification-opt-in-option-id';

export const APPOINTMENT_NOTIFICATION_OPT_IN_TEXT =
  'Autorizas a IPS SISM a contactarte por WhatsApp para recordatorios, confirmaciones, cambios y otras notificaciones relacionadas con tus citas, asi como para encuestas de satisfaccion sobre la atencion recibida?\n\n' +
  'Al seleccionar "Si autorizo", aceptas recibir estos mensajes en el numero registrado.';

@Injectable()
export class AppointmentNotificationOptInMessageFactory {
  build(): ConversationOutboundInteractiveButtonsMessage {
    return {
      type: 'interactive_buttons',
      body: APPOINTMENT_NOTIFICATION_OPT_IN_TEXT,
      buttons: [
        {
          id: APPOINTMENT_NOTIFICATION_OPT_IN_OPTION_IDS.ACCEPT,
          title: 'Si autorizo',
        },
        {
          id: APPOINTMENT_NOTIFICATION_OPT_IN_OPTION_IDS.DECLINE,
          title: 'No autorizo',
        },
      ],
    };
  }
}
