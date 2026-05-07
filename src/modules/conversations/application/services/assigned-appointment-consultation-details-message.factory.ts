import { Injectable } from '@nestjs/common';
import type { ConversationOutboundInteractiveButtonsMessage } from '../../domain/value-objects/conversation-outbound-message';
import { NAVIGATION_OPTION_IDS } from './conversation-navigation.service';

export interface AssignedAppointmentConsultationDetailsMessageInput {
  patientFullName: string;
  specialtyName: string;
  professionalName: string;
  siteName: string;
  siteAddress: string;
  appointmentDateIso: string;
  appointmentDisplayTime: string;
}

@Injectable()
export class AssignedAppointmentConsultationDetailsMessageFactory {
  build(
    appointment: AssignedAppointmentConsultationDetailsMessageInput,
  ): ConversationOutboundInteractiveButtonsMessage {
    return {
      type: 'interactive_buttons',
      body:
        `Señor(a) ${appointment.patientFullName}, su cita agendada es:.\n\n` +
        `🩺Especialidad: ${appointment.specialtyName}\n` +
        '👩🏼‍💻Modalida: PRESENCIAL\n' +
        `📅Fecha de la cita: ${appointment.appointmentDateIso}\n` +
        `🕜Hora: ${appointment.appointmentDisplayTime}\n` +
        `👩🏼‍⚕️Profesional: ${appointment.professionalName}\n` +
        `🏙️Sede: ${appointment.siteName}.\n` +
        `🏙️Direccion: ${appointment.siteAddress}.\n\n` +
        'Favor estar 🕘 15 minutos antes de la hora asignada',
      buttons: [
        {
          id: NAVIGATION_OPTION_IDS.BACK,
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
