import { Injectable } from '@nestjs/common';
import type { ConversationOutboundInteractiveButtonsMessage } from '../../domain/value-objects/conversation-outbound-message';
import { NAVIGATION_OPTION_IDS } from './conversation-navigation.service';
import { PENDING_APPOINTMENT_BLOCK_OPTION_IDS } from './pending-appointment-block-option-id';

export interface PendingAppointmentBlockMessageInput {
  patientName: string;
  specialtyName: string;
  modality: string;
  appointmentDateIso: string;
  appointmentDisplayTime: string;
  professionalName: string;
  siteName: string;
  siteAddress: string;
}

@Injectable()
export class PendingAppointmentBlockMessageFactory {
  build(
    input: PendingAppointmentBlockMessageInput,
  ): ConversationOutboundInteractiveButtonsMessage {
    const patientName = input.patientName.trim() || 'PACIENTE';

    return {
      type: 'interactive_buttons',
      body:
        `Hola ${patientName} ya tienes una cita asignada para ${input.specialtyName}:\n\n` +
        `🩺Especialidad: ${input.specialtyName}\n` +
        `👩🏼‍💻Modalidad: ${input.modality}\n` +
        `📅Fecha de la cita: ${input.appointmentDateIso}\n` +
        `🕜Hora: ${input.appointmentDisplayTime}\n` +
        `👩🏼‍⚕️Profesional: ${input.professionalName}\n` +
        `🏙️Sede: ${input.siteName}.\n` +
        `🏙️Dirección: ${input.siteAddress}.`,
      buttons: [
        {
          id: PENDING_APPOINTMENT_BLOCK_OPTION_IDS.BACK_TO_SPECIALTIES,
          title: 'Volver',
        },
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
