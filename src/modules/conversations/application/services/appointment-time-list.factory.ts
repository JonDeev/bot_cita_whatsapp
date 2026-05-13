import { Injectable } from '@nestjs/common';
import type { ConversationOutboundInteractiveListMessage } from '../../domain/value-objects/conversation-outbound-message';
import {
  APPOINTMENT_TIME_SHOW_MORE_OPTION_ID,
  buildAppointmentTimeOptionId,
} from './appointment-time-option-id';

interface AppointmentTimeListItem {
  slotRef: string;
  displayTime: string;
}

@Injectable()
export class AppointmentTimeListFactory {
  private static readonly MAX_TIME_ROWS = 9;

  build(
    times: AppointmentTimeListItem[],
    hasMoreTimes: boolean,
  ): ConversationOutboundInteractiveListMessage {
    const rows = times
      .slice(0, AppointmentTimeListFactory.MAX_TIME_ROWS)
      .map((time) => ({
        id: buildAppointmentTimeOptionId(time.slotRef),
        title: time.displayTime,
      }));

    if (hasMoreTimes) {
      rows.push({
        id: APPOINTMENT_TIME_SHOW_MORE_OPTION_ID,
        title: 'Mostrar mas',
      });
    }

    return {
      type: 'interactive_list',
      body: 'Selecciona la hora de la cita',
      buttonText: 'Ver horas',
      sections: [
        {
          title: 'Horas disponibles',
          rows,
        },
      ],
    };
  }
}
