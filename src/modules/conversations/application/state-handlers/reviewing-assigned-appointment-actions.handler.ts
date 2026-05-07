import { Injectable } from '@nestjs/common';
import { CancelAssignedAppointmentByPatientUseCase } from '../../../appointments/application/use-cases/cancel-assigned-appointment-by-patient.use-case';
import { ListFutureAssignedAppointmentsByPatientUseCase } from '../../../appointments/application/use-cases/list-future-assigned-appointments-by-patient.use-case';
import { ResolveAvailableAppointmentDatesBySpecialtyUseCase } from '../../../appointments/application/use-cases/resolve-available-appointment-dates-by-specialty.use-case';
import { AuditService } from '../../../audit/application/services/audit.service';
import type { NormalizedWhatsappEvent } from '../../../whatsapp/domain/events/normalized-whatsapp.event';
import { CONVERSATION_STATES } from '../../domain/conversation-state';
import type { AssignedAppointmentSelectionSessionContext } from '../../domain/entities/conversation-session-context.entity';
import type { ConversationSession } from '../../domain/entities/conversation-session.entity';
import {
  ASSIGNED_APPOINTMENT_ACTION_OPTION_IDS,
  isAssignedAppointmentActionOptionId,
} from '../services/assigned-appointment-action-option-id';
import { AssignedAppointmentDetailsMessageFactory } from '../services/assigned-appointment-details-message.factory';
import { AssignedAppointmentListFactory } from '../services/assigned-appointment-list.factory';
import { AppointmentDateListFactory } from '../services/appointment-date-list.factory';
import type {
  ConversationStateHandler,
  ConversationStateHandlerResult,
} from './conversation-state-handler';

@Injectable()
export class ReviewingAssignedAppointmentActionsHandler implements ConversationStateHandler {
  readonly state = CONVERSATION_STATES.REVIEWING_ASSIGNED_APPOINTMENT_ACTIONS;

  constructor(
    private readonly cancelAssignedAppointmentByPatient: CancelAssignedAppointmentByPatientUseCase,
    private readonly listFutureAssignedAppointmentsByPatient: ListFutureAssignedAppointmentsByPatientUseCase,
    private readonly resolveAvailableAppointmentDatesBySpecialty: ResolveAvailableAppointmentDatesBySpecialtyUseCase,
    private readonly assignedAppointmentListFactory: AssignedAppointmentListFactory,
    private readonly assignedAppointmentDetailsMessageFactory: AssignedAppointmentDetailsMessageFactory,
    private readonly appointmentDateListFactory: AppointmentDateListFactory,
    private readonly auditService: AuditService,
  ) {}

  async handle(
    session: ConversationSession,
    event: NormalizedWhatsappEvent,
  ): Promise<ConversationStateHandlerResult> {
    const selection = session.context?.assignedAppointmentSelection;
    const selectedAppointment = selection?.selectedAppointment;

    if (event.kind !== 'incoming_message_received') {
      return {
        nextState: CONVERSATION_STATES.REVIEWING_ASSIGNED_APPOINTMENT_ACTIONS,
        outboundMessages: [],
      };
    }

    if (!selectedAppointment) {
      return this.rebuildSelectionList(session);
    }

    if (
      event.messageType !== 'interactive' ||
      !isAssignedAppointmentActionOptionId(event.interactiveReplyId)
    ) {
      return {
        nextState: CONVERSATION_STATES.REVIEWING_ASSIGNED_APPOINTMENT_ACTIONS,
        outboundMessages: [this.buildDetailsMessage(selection, selectedAppointment)],
      };
    }

    if (event.interactiveReplyId === ASSIGNED_APPOINTMENT_ACTION_OPTION_IDS.REPROGRAM) {
      return this.handleReprogramSelection(session, selection, selectedAppointment);
    }

    await this.auditService.record('appointment.cancellation.attempted', {
      conversationKey: session.conversationKey,
      patientId: session.context?.patientValidation?.patientId ?? null,
      slotRef: selectedAppointment.slotRef,
    });

    const cancellationResult = await this.cancelAssignedAppointmentByPatient.execute({
      patientId: session.context?.patientValidation?.patientId ?? null,
      slotRef: selectedAppointment.slotRef,
    });

    if (cancellationResult.status === 'CANCELLED') {
      await this.auditService.record('appointment.cancellation.succeeded', {
        conversationKey: session.conversationKey,
        patientId: session.context?.patientValidation?.patientId ?? null,
        slotRef: selectedAppointment.slotRef,
        cancelledAt: new Date().toISOString(),
      });

      return {
        nextState: CONVERSATION_STATES.SELECTING_ASSIGNED_APPOINTMENT,
        nextContext: {
          ...session.context,
          appointmentReschedule: undefined,
          specialtySelection: undefined,
          appointmentDoctorSelection: undefined,
          appointmentDateSelection: undefined,
          appointmentTimeSelection: undefined,
          assignedAppointmentSelection: {
            patientFullName: selection?.patientFullName ?? 'PACIENTE',
            currentOffset: 0,
            hasMoreAppointments: false,
            offeredAppointments: [],
            selectedAppointment: undefined,
          },
        },
        outboundMessages: [
          {
            type: 'text',
            body: 'Su cita se cancelo correctamente',
          },
        ],
      };
    }

    if (cancellationResult.status === 'NOT_CANCELLABLE') {
      await this.auditService.record('appointment.cancellation.rejected', {
        conversationKey: session.conversationKey,
        patientId: session.context?.patientValidation?.patientId ?? null,
        slotRef: selectedAppointment.slotRef,
      });

      return this.rebuildSelectionList(
        session,
        'La cita seleccionada ya no esta disponible para cancelar. Te mostramos las citas asignadas actualizadas.',
      );
    }

    await this.auditService.record('appointment.cancellation.failed', {
      conversationKey: session.conversationKey,
      patientId: session.context?.patientValidation?.patientId ?? null,
      slotRef: selectedAppointment.slotRef,
      reason: cancellationResult.reason,
    });

    return {
      nextState: CONVERSATION_STATES.SELECTING_ASSIGNED_APPOINTMENT,
      nextContext: {
        ...session.context,
        appointmentReschedule: undefined,
        specialtySelection: undefined,
        appointmentDoctorSelection: undefined,
        appointmentDateSelection: undefined,
        appointmentTimeSelection: undefined,
        assignedAppointmentSelection: {
          patientFullName: selection?.patientFullName ?? 'PACIENTE',
          currentOffset: 0,
          hasMoreAppointments: false,
          offeredAppointments: [],
          selectedAppointment: undefined,
        },
      },
      outboundMessages: [
        {
          type: 'text',
          body: 'No fue posible cancelar la cita en este momento. Intenta nuevamente en unos minutos desde el menu principal.',
        },
      ],
    };
  }

  private async rebuildSelectionList(
    session: ConversationSession,
    prefixMessage?: string,
  ): Promise<ConversationStateHandlerResult> {
    const listResult = await this.listFutureAssignedAppointmentsByPatient.execute({
      patientId: session.context?.patientValidation?.patientId ?? null,
      offset: 0,
    });

    if (listResult.status === 'FOUND') {
      const outboundMessages: ConversationStateHandlerResult['outboundMessages'] = [];
      if (prefixMessage) {
        outboundMessages.push({ type: 'text', body: prefixMessage });
      }
      outboundMessages.push(
        this.assignedAppointmentListFactory.build(
          listResult.appointments,
          listResult.hasMore,
        ),
      );

      return {
        nextState: CONVERSATION_STATES.SELECTING_ASSIGNED_APPOINTMENT,
        nextContext: {
          ...session.context,
          appointmentReschedule: undefined,
          specialtySelection: undefined,
          appointmentDoctorSelection: undefined,
          appointmentDateSelection: undefined,
          appointmentTimeSelection: undefined,
          assignedAppointmentSelection: {
            patientFullName: listResult.patientFullName,
            currentOffset: listResult.currentOffset,
            hasMoreAppointments: listResult.hasMore,
            nextOffset: listResult.nextOffset,
            offeredAppointments: listResult.appointments,
            selectedAppointment: undefined,
          },
        },
        outboundMessages,
      };
    }

    if (listResult.status === 'EMPTY') {
      return {
        nextState: CONVERSATION_STATES.SELECTING_ASSIGNED_APPOINTMENT,
        nextContext: {
          ...session.context,
          appointmentReschedule: undefined,
          specialtySelection: undefined,
          appointmentDoctorSelection: undefined,
          appointmentDateSelection: undefined,
          appointmentTimeSelection: undefined,
          assignedAppointmentSelection: {
            patientFullName: listResult.patientFullName,
            currentOffset: 0,
            hasMoreAppointments: false,
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
          body: 'No encontramos citas asignadas para continuar. Usa Menu principal para iniciar una nueva solicitud.',
        },
      ],
    };
  }

  private buildDetailsMessage(
    selection: AssignedAppointmentSelectionSessionContext | undefined,
    selectedAppointment: NonNullable<AssignedAppointmentSelectionSessionContext['selectedAppointment']>,
  ) {
    return this.assignedAppointmentDetailsMessageFactory.build({
      patientFullName: selection?.patientFullName ?? 'PACIENTE',
      specialtyName: selectedAppointment.specialtyName,
      professionalName: selectedAppointment.professionalName,
      appointmentDateIso: selectedAppointment.appointmentDateIso,
      appointmentDisplayTime: selectedAppointment.appointmentDisplayTime,
    });
  }

  private async handleReprogramSelection(
    session: ConversationSession,
    selection: AssignedAppointmentSelectionSessionContext | undefined,
    selectedAppointment: NonNullable<AssignedAppointmentSelectionSessionContext['selectedAppointment']>,
  ): Promise<ConversationStateHandlerResult> {
    const patientId = session.context?.patientValidation?.patientId ?? null;
    const specialtyCups = selectedAppointment.specialtyCups?.trim() ?? '';
    const specialtyName = selectedAppointment.specialtyName?.trim() || 'ESPECIALIDAD POR CONFIRMAR';

    await this.auditService.record('conversation.assigned_appointment.reprogramming.started', {
      conversationKey: session.conversationKey,
      patientId,
      slotRef: selectedAppointment.slotRef,
      specialtyCups: specialtyCups || null,
    });

    if (!specialtyCups) {
      await this.auditService.record('appointment.rescheduling.rejected', {
        conversationKey: session.conversationKey,
        patientId,
        originalSlotRef: selectedAppointment.slotRef,
        reason: 'MISSING_SPECIALTY_CUPS',
      });

      return {
        nextState: CONVERSATION_STATES.REVIEWING_ASSIGNED_APPOINTMENT_ACTIONS,
        nextContext: {
          ...session.context,
          appointmentReschedule: undefined,
          specialtySelection: undefined,
          appointmentDoctorSelection: undefined,
          appointmentDateSelection: undefined,
          appointmentTimeSelection: undefined,
        },
        outboundMessages: [
          {
            type: 'text',
            body: 'En este momento no podemos reprogramar esta cita automaticamente. Por favor intenta con un asesor desde el menu principal.',
          },
          this.buildDetailsMessage(selection, selectedAppointment),
        ],
      };
    }

    let availabilityResult:
      | {
          hasAvailability: false;
          reason: string;
        }
      | {
          hasAvailability: true;
          dates: Array<{ isoDate: string; displayDate: string }>;
        };
    try {
      availabilityResult = await this.resolveAvailableAppointmentDatesBySpecialty.execute({
        specialtyCups,
      });
    } catch (error) {
      await this.auditService.record('appointment.rescheduling.failed', {
        conversationKey: session.conversationKey,
        patientId,
        originalSlotRef: selectedAppointment.slotRef,
        specialtyCups,
        reason: error instanceof Error ? error.message : 'UNEXPECTED_ERROR',
      });

      return {
        nextState: CONVERSATION_STATES.REVIEWING_ASSIGNED_APPOINTMENT_ACTIONS,
        nextContext: {
          ...session.context,
          appointmentReschedule: undefined,
          specialtySelection: undefined,
          appointmentDoctorSelection: undefined,
          appointmentDateSelection: undefined,
          appointmentTimeSelection: undefined,
        },
        outboundMessages: [
          {
            type: 'text',
            body: 'En este momento no podemos consultar la agenda para reprogramar esta cita. Intenta nuevamente en unos minutos.',
          },
          this.buildDetailsMessage(selection, selectedAppointment),
        ],
      };
    }

    if (!availabilityResult.hasAvailability) {
      await this.auditService.record('appointment.rescheduling.rejected', {
        conversationKey: session.conversationKey,
        patientId,
        originalSlotRef: selectedAppointment.slotRef,
        specialtyCups,
        reason: availabilityResult.reason,
      });

      return {
        nextState: CONVERSATION_STATES.REVIEWING_ASSIGNED_APPOINTMENT_ACTIONS,
        nextContext: {
          ...session.context,
          appointmentReschedule: undefined,
          specialtySelection: undefined,
          appointmentDoctorSelection: undefined,
          appointmentDateSelection: undefined,
          appointmentTimeSelection: undefined,
        },
        outboundMessages: [
          {
            type: 'text',
            body: 'Disculpanos, en este momento no hay fechas disponibles para reprogramar esta especialidad.',
          },
          this.buildDetailsMessage(selection, selectedAppointment),
        ],
      };
    }

    await this.auditService.record('appointment.rescheduling.availability.resolved', {
      conversationKey: session.conversationKey,
      patientId,
      originalSlotRef: selectedAppointment.slotRef,
      specialtyCups,
      availableDateCount: availabilityResult.dates.length,
    });

    const selectedSpecialty = {
      code: specialtyCups,
      name: specialtyName,
      cups: specialtyCups,
    };

    return {
      nextState: CONVERSATION_STATES.SELECTING_APPOINTMENT_DATE,
      nextContext: {
        ...session.context,
        appointmentReschedule: {
          originalSlotRef: selectedAppointment.slotRef,
          originalSpecialtyName: specialtyName,
          originalSpecialtyCups: specialtyCups,
          originalAppointmentDateIso: selectedAppointment.appointmentDateIso,
          originalAppointmentTimeHHmm: selectedAppointment.appointmentTimeHHmm,
        },
        specialtySelection: {
          offeredSpecialties: [selectedSpecialty],
          selectedSpecialty,
        },
        appointmentDoctorSelection: undefined,
        appointmentDateSelection: {
          scope: 'SPECIALTY',
          specialtyOfferedDates: availabilityResult.dates,
          offeredDates: availabilityResult.dates,
        },
        appointmentTimeSelection: undefined,
      },
      outboundMessages: [
        this.appointmentDateListFactory.build(availabilityResult.dates, {
          includeChooseDoctor: true,
        }),
      ],
    };
  }
}
