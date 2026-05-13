import { Injectable } from '@nestjs/common';
import { ListFutureAssignedAppointmentsByPatientUseCase } from '../../../appointments/application/use-cases/list-future-assigned-appointments-by-patient.use-case';
import { RescheduleAssignedAppointmentByPatientUseCase } from '../../../appointments/application/use-cases/reschedule-assigned-appointment-by-patient.use-case';
import { AuditService } from '../../../audit/application/services/audit.service';
import { CONVERSATION_STATES } from '../../domain/conversation-state';
import type { OfferedAppointmentTimeSessionContext } from '../../domain/entities/conversation-session-context.entity';
import type { ConversationSession } from '../../domain/entities/conversation-session.entity';
import { AssignedAppointmentListFactory } from './assigned-appointment-list.factory';
import { AppointmentAvailabilityMessageFactory } from './appointment-availability-message.factory';
import { AppointmentRescheduleConfirmationMessageFactory } from './appointment-reschedule-confirmation-message.factory';
import type { ConversationStateHandlerResult } from '../state-handlers/conversation-state-handler';

export type RescheduleAfterTimeSelectionOutcome =
  | {
      status: 'COMPLETED';
      result: ConversationStateHandlerResult;
    }
  | {
      status: 'TIME_NO_LONGER_AVAILABLE';
      selectedDisplayTime: string;
    };

@Injectable()
export class AppointmentReschedulingTimeSelectionService {
  constructor(
    private readonly rescheduleAssignedAppointmentByPatient: RescheduleAssignedAppointmentByPatientUseCase,
    private readonly listFutureAssignedAppointmentsByPatient: ListFutureAssignedAppointmentsByPatientUseCase,
    private readonly assignedAppointmentListFactory: AssignedAppointmentListFactory,
    private readonly appointmentRescheduleConfirmationMessageFactory: AppointmentRescheduleConfirmationMessageFactory,
    private readonly appointmentAvailabilityMessageFactory: AppointmentAvailabilityMessageFactory,
    private readonly auditService: AuditService,
  ) {}

  async handleAfterTimeSelection(
    session: ConversationSession,
    selectedTime: OfferedAppointmentTimeSessionContext,
  ): Promise<RescheduleAfterTimeSelectionOutcome> {
    const rescheduleContext = session.context?.appointmentReschedule;
    const selectedSpecialty =
      session.context?.specialtySelection?.selectedSpecialty;
    const selectedDoctor =
      session.context?.appointmentDoctorSelection?.selectedDoctor;
    const selectedDateIso =
      session.context?.appointmentDateSelection?.selectedDateIso;
    const patientId = session.context?.patientValidation?.patientId ?? null;

    if (!rescheduleContext || !selectedSpecialty?.cups || !selectedDateIso) {
      await this.auditService.record('appointment.rescheduling.failed', {
        conversationKey: session.conversationKey,
        patientId,
        originalSlotRef: rescheduleContext?.originalSlotRef ?? null,
        preferredSlotRef: selectedTime.slotRef,
        reason: 'INVALID_RESCHEDULE_CONTEXT',
      });

      return {
        status: 'COMPLETED',
        result: {
          nextState: CONVERSATION_STATES.MAIN_MENU,
          nextContext: {
            ...session.context,
            appointmentReschedule: undefined,
            specialtySelection: undefined,
            appointmentDoctorSelection: undefined,
            appointmentDateSelection: undefined,
            appointmentTimeSelection: undefined,
          },
          outboundMessages: [
            this.appointmentAvailabilityMessageFactory.buildTechnicalFailure(),
          ],
        },
      };
    }

    await this.auditService.record('appointment.rescheduling.attempted', {
      conversationKey: session.conversationKey,
      patientId,
      originalSlotRef: rescheduleContext.originalSlotRef,
      preferredSlotRef: selectedTime.slotRef,
      specialtyCups: selectedSpecialty.cups,
      appointmentDate: selectedDateIso,
      appointmentTime: selectedTime.timeHHmm,
      doctorEmployeeCode: selectedDoctor?.employeeCode ?? null,
    });

    const rescheduleResult =
      await this.rescheduleAssignedAppointmentByPatient.execute({
        patientId,
        originalSlotRef: rescheduleContext.originalSlotRef,
        specialtyName: selectedSpecialty.name,
        specialtyCups: selectedSpecialty.cups,
        appointmentDateIso: selectedDateIso,
        appointmentTimeHHmm: selectedTime.timeHHmm,
        preferredNewSlotRef: selectedTime.slotRef,
        doctorEmployeeCode: selectedDoctor?.employeeCode ?? null,
      });

    if (rescheduleResult.status === 'RESCHEDULED') {
      if (rescheduleResult.appointment.usedFallbackSlot) {
        await this.auditService.record(
          'appointment.rescheduling.primary_slot_unavailable',
          {
            conversationKey: session.conversationKey,
            originalSlotRef: rescheduleContext.originalSlotRef,
            preferredSlotRef: selectedTime.slotRef,
          },
        );

        await this.auditService.record(
          'appointment.rescheduling.fallback_slot_found',
          {
            conversationKey: session.conversationKey,
            originalSlotRef: rescheduleContext.originalSlotRef,
            preferredSlotRef: selectedTime.slotRef,
            assignedSlotRef: rescheduleResult.appointment.slotRef,
          },
        );
      }

      await this.auditService.record('appointment.rescheduling.succeeded', {
        conversationKey: session.conversationKey,
        patientId,
        originalSlotRef: rescheduleContext.originalSlotRef,
        assignedSlotRef: rescheduleResult.appointment.slotRef,
        usedFallbackSlot: rescheduleResult.appointment.usedFallbackSlot,
      });

      return {
        status: 'COMPLETED',
        result: {
          nextState: CONVERSATION_STATES.MAIN_MENU,
          nextContext: {
            ...session.context,
            appointmentReschedule: undefined,
            assignedAppointmentSelection: undefined,
            specialtySelection: undefined,
            appointmentDoctorSelection: undefined,
            appointmentDateSelection: undefined,
            appointmentTimeSelection: undefined,
          },
          outboundMessages: [
            this.appointmentRescheduleConfirmationMessageFactory.build(
              rescheduleResult.appointment,
            ),
          ],
        },
      };
    }

    if (rescheduleResult.status === 'TIME_NO_LONGER_AVAILABLE') {
      await this.auditService.record(
        'appointment.rescheduling.time_exhausted',
        {
          conversationKey: session.conversationKey,
          patientId,
          originalSlotRef: rescheduleContext.originalSlotRef,
          preferredSlotRef: selectedTime.slotRef,
        },
      );

      return {
        status: 'TIME_NO_LONGER_AVAILABLE',
        selectedDisplayTime: selectedTime.displayTime,
      };
    }

    if (rescheduleResult.status === 'ORIGINAL_APPOINTMENT_NOT_REBOOKABLE') {
      await this.auditService.record('appointment.rescheduling.rejected', {
        conversationKey: session.conversationKey,
        patientId,
        originalSlotRef: rescheduleContext.originalSlotRef,
        preferredSlotRef: selectedTime.slotRef,
        reason: 'ORIGINAL_APPOINTMENT_NOT_REBOOKABLE',
      });

      return {
        status: 'COMPLETED',
        result:
          await this.rebuildAssignedAppointmentListAfterRescheduleRejection(
            session,
            'La cita original ya no esta disponible para reprogramar. Te mostramos tus citas asignadas actualizadas.',
          ),
      };
    }

    await this.auditService.record('appointment.rescheduling.failed', {
      conversationKey: session.conversationKey,
      patientId,
      originalSlotRef: rescheduleContext.originalSlotRef,
      preferredSlotRef: selectedTime.slotRef,
      reason: rescheduleResult.reason,
    });

    return {
      status: 'COMPLETED',
      result: {
        nextState: CONVERSATION_STATES.MAIN_MENU,
        nextContext: {
          ...session.context,
          appointmentReschedule: undefined,
          specialtySelection: undefined,
          appointmentDoctorSelection: undefined,
          appointmentDateSelection: undefined,
          appointmentTimeSelection: undefined,
        },
        outboundMessages: [
          this.appointmentAvailabilityMessageFactory.buildTechnicalFailure(),
        ],
      },
    };
  }

  private async rebuildAssignedAppointmentListAfterRescheduleRejection(
    session: ConversationSession,
    prefixMessage: string,
  ): Promise<ConversationStateHandlerResult> {
    const listResult =
      await this.listFutureAssignedAppointmentsByPatient.execute({
        patientId: session.context?.patientValidation?.patientId ?? null,
        offset: 0,
      });

    if (listResult.status === 'FOUND') {
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
        outboundMessages: [
          {
            type: 'text',
            body: prefixMessage,
          },
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
      nextState: CONVERSATION_STATES.MAIN_MENU,
      nextContext: {
        ...session.context,
        appointmentReschedule: undefined,
        specialtySelection: undefined,
        appointmentDoctorSelection: undefined,
        appointmentDateSelection: undefined,
        appointmentTimeSelection: undefined,
      },
      outboundMessages: [
        this.appointmentAvailabilityMessageFactory.buildTechnicalFailure(),
      ],
    };
  }
}
