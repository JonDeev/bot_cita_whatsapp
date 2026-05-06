import { Injectable } from '@nestjs/common';
import type { ConversationOutboundInteractiveListMessage } from '../../domain/value-objects/conversation-outbound-message';
import { buildAppointmentDateOptionId } from './appointment-date-option-id';

interface AppointmentDateListItem {
  isoDate: string;
  displayDate: string;
}

@Injectable()
export class AppointmentDateListFactory {
  build(dates: AppointmentDateListItem[]): ConversationOutboundInteractiveListMessage {
    return {
      type: 'interactive_list',
      body: 'Selecciona el dia de la cita',
      buttonText: 'Ver fechas',
      sections: [
        {
          title: 'Dias disponibles',
          rows: dates.map((date) => ({
            id: buildAppointmentDateOptionId(date.isoDate),
            title: date.displayDate,
          })),
        },
      ],
    };
  }
}
