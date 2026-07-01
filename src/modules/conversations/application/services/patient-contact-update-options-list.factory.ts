import { Injectable } from '@nestjs/common';
import type { ConversationOutboundInteractiveListMessage } from '../../domain/value-objects/conversation-outbound-message';
import { PATIENT_CONTACT_UPDATE_FIELD_OPTION_IDS } from './patient-contact-update-field-option-id';

@Injectable()
export class PatientContactUpdateOptionsListFactory {
  build(): ConversationOutboundInteractiveListMessage {
    return {
      type: 'interactive_list',
      body: 'Selecciona el dato de contacto que deseas actualizar.',
      buttonText: 'Ver opciones',
      sections: [
        {
          title: 'Actualizar contacto',
          rows: [
            {
              id: PATIENT_CONTACT_UPDATE_FIELD_OPTION_IDS.PHONE,
              title: 'Telefono',
            },
            {
              id: PATIENT_CONTACT_UPDATE_FIELD_OPTION_IDS.BOTH,
              title: 'Telefono y correo',
            },
            {
              id: PATIENT_CONTACT_UPDATE_FIELD_OPTION_IDS.BACK,
              title: 'Volver',
            },
            {
              id: PATIENT_CONTACT_UPDATE_FIELD_OPTION_IDS.MAIN_MENU,
              title: 'Menu principal',
            },
            {
              id: PATIENT_CONTACT_UPDATE_FIELD_OPTION_IDS.FINISH,
              title: 'Finalizar',
            },
          ],
        },
      ],
    };
  }
}
