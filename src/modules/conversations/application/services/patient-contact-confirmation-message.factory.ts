import { Injectable } from '@nestjs/common';
import type { ConversationOutboundInteractiveButtonsMessage } from '../../domain/value-objects/conversation-outbound-message';
import { PATIENT_CONTACT_CONFIRMATION_OPTION_IDS } from './patient-contact-confirmation-option-id';

export interface PatientContactConfirmationMessageInput {
  fullName: string;
  primaryPhone: string | null;
  primaryEmail: string | null;
}

@Injectable()
export class PatientContactConfirmationMessageFactory {
  build(
    input: PatientContactConfirmationMessageInput,
  ): ConversationOutboundInteractiveButtonsMessage {
    return {
      type: 'interactive_buttons',
      body: [
        `Hola ${input.fullName}. Por favor verifica que tus datos de contacto esten correctos. Los usamos para enviarte los recordatorios de tu cita a tiempo. ✅`,
        '',
        `📱Telefono: ${input.primaryPhone ?? 'No registrado'}`,
        `📧Correo electronico: ${input.primaryEmail ?? 'No registrado'}`,
        '',
        '¿La informacion es correcta? ❓',
      ].join('\n'),
      buttons: [
        {
          id: PATIENT_CONTACT_CONFIRMATION_OPTION_IDS.CONTINUE,
          title: 'Continuar',
        },
        {
          id: PATIENT_CONTACT_CONFIRMATION_OPTION_IDS.UPDATE_AND_CONTINUE,
          title: 'Actualizar y seguir',
        },
        {
          id: PATIENT_CONTACT_CONFIRMATION_OPTION_IDS.FINISH,
          title: 'Terminar',
        },
      ],
    };
  }
}
