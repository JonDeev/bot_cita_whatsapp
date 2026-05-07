import { Injectable } from '@nestjs/common';
import type { NormalizedWhatsappEvent } from '../../../whatsapp/domain/events/normalized-whatsapp.event';
import { CONVERSATION_STATES } from '../../domain/conversation-state';
import type { ConversationSession } from '../../domain/entities/conversation-session.entity';
import { AssignedAppointmentConsultationDetailsMessageFactory } from '../services/assigned-appointment-consultation-details-message.factory';
import { AssignedAppointmentListFactory } from '../services/assigned-appointment-list.factory';
import type {
  ConversationStateHandler,
  ConversationStateHandlerResult,
} from './conversation-state-handler';

@Injectable()
export class ReviewingAssignedAppointmentDetailsHandler implements ConversationStateHandler {
  readonly state = CONVERSATION_STATES.REVIEWING_ASSIGNED_APPOINTMENT_DETAILS;

  constructor(
    private readonly assignedAppointmentListFactory: AssignedAppointmentListFactory,
    private readonly assignedAppointmentConsultationDetailsMessageFactory: AssignedAppointmentConsultationDetailsMessageFactory,
  ) {}

  async handle(
    session: ConversationSession,
    event: NormalizedWhatsappEvent,
  ): Promise<ConversationStateHandlerResult> {
    if (event.kind !== 'incoming_message_received') {
      return {
        nextState: CONVERSATION_STATES.REVIEWING_ASSIGNED_APPOINTMENT_DETAILS,
        outboundMessages: [],
      };
    }

    const selection = session.context?.assignedAppointmentSelection;
    const selectedAppointment = selection?.selectedAppointment;
    const offeredAppointments = selection?.offeredAppointments ?? [];

    if (!selectedAppointment) {
      if (offeredAppointments.length > 0) {
        return {
          nextState: CONVERSATION_STATES.SELECTING_ASSIGNED_APPOINTMENT,
          outboundMessages: [
            this.assignedAppointmentListFactory.build(
              offeredAppointments,
              selection?.hasMoreAppointments ?? false,
              {
                mode: 'CHECK_APPOINTMENTS',
                patientFullName: selection?.patientFullName,
              },
            ),
          ],
        };
      }

      return {
        nextState: CONVERSATION_STATES.SELECTING_ASSIGNED_APPOINTMENT,
        outboundMessages: [
          {
            type: 'text',
            body: 'No encontramos citas asignadas para continuar. Usa Menu principal para iniciar una nueva solicitud.',
          },
        ],
      };
    }

    return {
      nextState: CONVERSATION_STATES.REVIEWING_ASSIGNED_APPOINTMENT_DETAILS,
      outboundMessages: [
        this.assignedAppointmentConsultationDetailsMessageFactory.build({
          patientFullName: selection?.patientFullName ?? 'PACIENTE',
          specialtyName: selectedAppointment.specialtyName,
          professionalName: selectedAppointment.professionalName,
          siteName: selectedAppointment.siteName,
          siteAddress: selectedAppointment.siteAddress,
          appointmentDateIso: selectedAppointment.appointmentDateIso,
          appointmentDisplayTime: selectedAppointment.appointmentDisplayTime,
        }),
      ],
    };
  }
}
