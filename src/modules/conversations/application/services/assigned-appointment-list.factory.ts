import { Injectable } from '@nestjs/common';
import type { ConversationOutboundInteractiveListMessage } from '../../domain/value-objects/conversation-outbound-message';
import {
  ASSIGNED_APPOINTMENT_SHOW_MORE_OPTION_ID,
  buildAssignedAppointmentOptionId,
} from './assigned-appointment-option-id';

interface AssignedAppointmentListItem {
  slotRef: string;
  specialtyName: string;
  appointmentDateIso: string;
  appointmentDisplayTime: string;
}

export interface AssignedAppointmentListBuildOptions {
  mode?: 'CANCEL_OR_RESCHEDULE' | 'CHECK_APPOINTMENTS';
  patientFullName?: string;
}

@Injectable()
export class AssignedAppointmentListFactory {
  private static readonly MAX_TITLE_LENGTH = 24;
  private static readonly TITLE_ELLIPSIS = '...';

  build(
    appointments: AssignedAppointmentListItem[],
    hasMoreAppointments: boolean,
    options: AssignedAppointmentListBuildOptions = {},
  ): ConversationOutboundInteractiveListMessage {
    const rows = appointments.map((appointment) => ({
      id: buildAssignedAppointmentOptionId(appointment.slotRef),
      title: this.truncateTitle(appointment.specialtyName),
      description: `${appointment.appointmentDateIso} ${appointment.appointmentDisplayTime}`,
    }));

    if (hasMoreAppointments) {
      rows.push({
        id: ASSIGNED_APPOINTMENT_SHOW_MORE_OPTION_ID,
        title: 'Ver mas citas',
        description: 'Consultar mas citas asignadas',
      });
    }

    return {
      type: 'interactive_list',
      body: this.resolveBody(options),
      buttonText: 'Ver citas',
      sections: [
        {
          title: 'Citas asignadas',
          rows,
        },
      ],
    };
  }

  private truncateTitle(title: string): string {
    const normalizedTitle = title.trim();
    if (
      Array.from(normalizedTitle).length <=
      AssignedAppointmentListFactory.MAX_TITLE_LENGTH
    ) {
      return normalizedTitle;
    }

    const maxWithoutEllipsis =
      AssignedAppointmentListFactory.MAX_TITLE_LENGTH -
      AssignedAppointmentListFactory.TITLE_ELLIPSIS.length;
    const truncated = Array.from(normalizedTitle)
      .slice(0, Math.max(1, maxWithoutEllipsis))
      .join('')
      .trim();

    return `${truncated}${AssignedAppointmentListFactory.TITLE_ELLIPSIS}`;
  }

  private resolveBody(options: AssignedAppointmentListBuildOptions): string {
    if (options.mode === 'CHECK_APPOINTMENTS') {
      const patientFullName = options.patientFullName?.trim() || 'PACIENTE';
      return `Hola ${patientFullName} Estas son tus citas agendadas`;
    }

    return 'Selecciona la cita que deseas mover o cancelar.';
  }
}
