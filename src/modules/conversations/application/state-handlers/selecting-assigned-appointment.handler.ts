import { Injectable } from '@nestjs/common';
import { ListFutureAssignedAppointmentsByPatientUseCase } from '../../../appointments/application/use-cases/list-future-assigned-appointments-by-patient.use-case';
import { AuditService } from '../../../audit/application/services/audit.service';
import type { NormalizedWhatsappEvent } from '../../../whatsapp/domain/events/normalized-whatsapp.event';
import { CONVERSATION_STATES } from '../../domain/conversation-state';
import type { AssignedAppointmentSelectionSessionContext } from '../../domain/entities/conversation-session-context.entity';
import type { ConversationSession } from '../../domain/entities/conversation-session.entity';
import { AssignedAppointmentDetailsMessageFactory } from '../services/assigned-appointment-details-message.factory';
import { AssignedAppointmentListFactory } from '../services/assigned-appointment-list.factory';
import { parseAssignedAppointmentOptionId } from '../services/assigned-appointment-option-id';
import type {
  ConversationStateHandler,
  ConversationStateHandlerResult,
} from './conversation-state-handler';

@Injectable()
export class SelectingAssignedAppointmentHandler implements ConversationStateHandler {
  readonly state = CONVERSATION_STATES.SELECTING_ASSIGNED_APPOINTMENT;

  constructor(
    private readonly listFutureAssignedAppointmentsByPatient: ListFutureAssignedAppointmentsByPatientUseCase,
    private readonly assignedAppointmentListFactory: AssignedAppointmentListFactory,
    private readonly assignedAppointmentDetailsMessageFactory: AssignedAppointmentDetailsMessageFactory,
    private readonly auditService: AuditService,
  ) {}

  async handle(
    session: ConversationSession,
    event: NormalizedWhatsappEvent,
  ): Promise<ConversationStateHandlerResult> {
    const selection = session.context?.assignedAppointmentSelection;
    const offeredAppointments = selection?.offeredAppointments ?? [];

    if (event.kind !== 'incoming_message_received') {
      return {
        nextState: CONVERSATION_STATES.SELECTING_ASSIGNED_APPOINTMENT,
        outboundMessages: [],
      };
    }

    if (offeredAppointments.length === 0) {
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

    const selectedOption = parseAssignedAppointmentOptionId(event.interactiveReplyId ?? '');
    if (!selectedOption) {
      return {
        nextState: CONVERSATION_STATES.SELECTING_ASSIGNED_APPOINTMENT,
        outboundMessages: [
          this.assignedAppointmentListFactory.build(
            offeredAppointments,
            selection?.hasMoreAppointments ?? false,
          ),
        ],
      };
    }

    if (selectedOption.kind === 'show_more') {
      return this.handleShowMoreSelection(session, selection);
    }

    const selectedAppointment = offeredAppointments.find(
      (appointment) => appointment.slotRef === selectedOption.slotRef,
    );
    if (!selectedAppointment) {
      return {
        nextState: CONVERSATION_STATES.SELECTING_ASSIGNED_APPOINTMENT,
        outboundMessages: [
          this.assignedAppointmentListFactory.build(
            offeredAppointments,
            selection?.hasMoreAppointments ?? false,
          ),
        ],
      };
    }

    await this.auditService.record('conversation.assigned_appointment.selected', {
      conversationKey: session.conversationKey,
      patientId: session.context?.patientValidation?.patientId ?? null,
      slotRef: selectedAppointment.slotRef,
    });

    const patientFullName = selection?.patientFullName?.trim() || 'PACIENTE';
    return {
      nextState: CONVERSATION_STATES.REVIEWING_ASSIGNED_APPOINTMENT_ACTIONS,
      nextContext: {
        ...session.context,
        appointmentReschedule: undefined,
        specialtySelection: undefined,
        appointmentDoctorSelection: undefined,
        appointmentDateSelection: undefined,
        appointmentTimeSelection: undefined,
        assignedAppointmentSelection: {
          ...(selection ?? {
            patientFullName,
            currentOffset: 0,
            hasMoreAppointments: false,
            offeredAppointments,
          }),
          patientFullName,
          selectedAppointment,
        },
      },
      outboundMessages: [
        this.assignedAppointmentDetailsMessageFactory.build({
          patientFullName,
          specialtyName: selectedAppointment.specialtyName,
          professionalName: selectedAppointment.professionalName,
          appointmentDateIso: selectedAppointment.appointmentDateIso,
          appointmentDisplayTime: selectedAppointment.appointmentDisplayTime,
        }),
      ],
    };
  }

  private async handleShowMoreSelection(
    session: ConversationSession,
    selection: AssignedAppointmentSelectionSessionContext | undefined,
  ): Promise<ConversationStateHandlerResult> {
    const offeredAppointments = selection?.offeredAppointments ?? [];
    if (!selection?.hasMoreAppointments || selection.nextOffset === undefined) {
      return {
        nextState: CONVERSATION_STATES.SELECTING_ASSIGNED_APPOINTMENT,
        outboundMessages: [
          this.assignedAppointmentListFactory.build(
            offeredAppointments,
            selection?.hasMoreAppointments ?? false,
          ),
        ],
      };
    }

    await this.auditService.record('appointment.assigned_list.show_more.selected', {
      conversationKey: session.conversationKey,
      patientId: session.context?.patientValidation?.patientId ?? null,
      currentOffset: selection.currentOffset,
      nextOffset: selection.nextOffset,
    });

    const listResult = await this.listFutureAssignedAppointmentsByPatient.execute({
      patientId: session.context?.patientValidation?.patientId ?? null,
      offset: selection.nextOffset,
    });

    if (listResult.status === 'FOUND') {
      return {
        nextState: CONVERSATION_STATES.SELECTING_ASSIGNED_APPOINTMENT,
        nextContext: {
          ...session.context,
          appointmentReschedule: undefined,
          assignedAppointmentSelection: {
            patientFullName: listResult.patientFullName,
            currentOffset: listResult.currentOffset,
            hasMoreAppointments: listResult.hasMore,
            nextOffset: listResult.nextOffset,
            offeredAppointments: listResult.appointments,
            selectedAppointment: undefined,
          },
        },
        outboundMessages: [
          this.assignedAppointmentListFactory.build(
            listResult.appointments,
            listResult.hasMore,
          ),
        ],
      };
    }

    if (listResult.status === 'EMPTY') {
      return {
        nextState: CONVERSATION_STATES.SELECTING_ASSIGNED_APPOINTMENT,
        nextContext: {
          ...session.context,
          appointmentReschedule: undefined,
          assignedAppointmentSelection: {
            patientFullName: listResult.patientFullName,
            currentOffset: listResult.currentOffset,
            hasMoreAppointments: false,
            nextOffset: undefined,
            offeredAppointments: [],
            selectedAppointment: undefined,
          },
        },
        outboundMessages: [
          {
            type: 'text',
            body: `Hola ${listResult.patientFullName} Usted no tiene citas agendadas`,
          },
        ],
      };
    }

    return {
      nextState: CONVERSATION_STATES.SELECTING_ASSIGNED_APPOINTMENT,
      outboundMessages: [
        {
          type: 'text',
          body: 'En este momento no podemos consultar tus citas asignadas. Intenta nuevamente en unos minutos desde el menu principal.',
        },
      ],
    };
  }
}
