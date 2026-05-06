import { Injectable } from '@nestjs/common';
import type { ConversationOutboundInteractiveListMessage } from '../../domain/value-objects/conversation-outbound-message';
import {
  APPOINTMENT_DATE_CHOOSE_DOCTOR_OPTION_ID,
  buildAppointmentDateOptionId,
} from './appointment-date-option-id';

interface AppointmentDateListItem {
  isoDate: string;
  displayDate: string;
}

@Injectable()
export class AppointmentDateListFactory {
  build(
    dates: AppointmentDateListItem[],
    options?: {
      includeChooseDoctor?: boolean;
    },
  ): ConversationOutboundInteractiveListMessage {
    const rows = dates.map((date) => ({
      id: buildAppointmentDateOptionId(date.isoDate),
      title: date.displayDate,
    }));

    if (options?.includeChooseDoctor) {
      rows.push({
        id: APPOINTMENT_DATE_CHOOSE_DOCTOR_OPTION_ID,
        title: 'Elegir medico',
      });
    }

    return {
      type: 'interactive_list',
      body: 'Selecciona el dia de la cita',
      buttonText: 'Ver fechas',
      sections: [
        {
          title: 'Dias disponibles',
          rows,
        },
      ],
    };
  }
}
