import { Injectable } from '@nestjs/common';
import type { ConversationOutboundInteractiveButtonsMessage } from '../../domain/value-objects/conversation-outbound-message';
import { ASSIGNED_APPOINTMENT_ACTION_OPTION_IDS } from './assigned-appointment-action-option-id';

export interface AssignedAppointmentDetailsMessageInput {
  patientFullName: string;
  specialtyName: string;
  professionalName: string;
  appointmentDateIso: string;
  appointmentDisplayTime: string;
}

@Injectable()
export class AssignedAppointmentDetailsMessageFactory {
  build(
    input: AssignedAppointmentDetailsMessageInput,
  ): ConversationOutboundInteractiveButtonsMessage {
    return {
      type: 'interactive_buttons',
      body:
        `Señor(a) ${input.patientFullName}, ⚠️ Usted cuenta con la siguiente cita asignada:\n\n` +
        `🩺Tipo de cita: ${input.specialtyName}\n` +
        `👨🏼‍⚕️Profesional: ${input.professionalName}\n` +
        `📅Fecha: ${input.appointmentDateIso}\n` +
        `🕗Hora: ${input.appointmentDisplayTime}`,
      buttons: [
        {
          id: ASSIGNED_APPOINTMENT_ACTION_OPTION_IDS.REPROGRAM,
          title: 'Reprogramar',
        },
        {
          id: ASSIGNED_APPOINTMENT_ACTION_OPTION_IDS.CANCEL,
          title: 'Cancelar',
        },
      ],
    };
  }
}
