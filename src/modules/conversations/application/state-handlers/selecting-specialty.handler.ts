import { Injectable } from '@nestjs/common';
import { FindNearestPendingFutureAppointmentByPatientAndSpecialtyUseCase } from '../../../appointments/application/use-cases/find-nearest-pending-future-appointment-by-patient-and-specialty.use-case';
import { ResolveAvailableAppointmentDatesBySpecialtyUseCase } from '../../../appointments/application/use-cases/resolve-available-appointment-dates-by-specialty.use-case';
import { AuditService } from '../../../audit/application/services/audit.service';
import type { NormalizedWhatsappEvent } from '../../../whatsapp/domain/events/normalized-whatsapp.event';
import { CONVERSATION_STATES } from '../../domain/conversation-state';
import type { ConversationSession } from '../../domain/entities/conversation-session.entity';
import { AppointmentAvailabilityMessageFactory } from '../services/appointment-availability-message.factory';
import { AppointmentDateListFactory } from '../services/appointment-date-list.factory';
import { PendingAppointmentBlockMessageFactory } from '../services/pending-appointment-block-message.factory';
import { PENDING_APPOINTMENT_BLOCK_OPTION_IDS } from '../services/pending-appointment-block-option-id';
import { parseSpecialtyOptionId } from '../services/specialty-option-id';
import { SpecialtyListFactory } from '../services/specialty-list.factory';
import type {
  ConversationStateHandler,
  ConversationStateHandlerResult,
} from './conversation-state-handler';

@Injectable()
export class SelectingSpecialtyHandler implements ConversationStateHandler {
  readonly state = CONVERSATION_STATES.SELECTING_SPECIALTY;

  constructor(
    private readonly specialtyListFactory: SpecialtyListFactory,
    private readonly appointmentDateListFactory: AppointmentDateListFactory,
    private readonly appointmentAvailabilityMessageFactory: AppointmentAvailabilityMessageFactory,
    private readonly pendingAppointmentBlockMessageFactory: PendingAppointmentBlockMessageFactory,
    private readonly findNearestPendingFutureAppointmentByPatientAndSpecialty: FindNearestPendingFutureAppointmentByPatientAndSpecialtyUseCase,
    private readonly resolveAvailableAppointmentDatesBySpecialty: ResolveAvailableAppointmentDatesBySpecialtyUseCase,
    private readonly auditService: AuditService,
  ) {}

  async handle(
    session: ConversationSession,
    event: NormalizedWhatsappEvent,
  ): Promise<ConversationStateHandlerResult> {
    const offeredSpecialties = session.context?.specialtySelection?.offeredSpecialties ?? [];

    if (event.kind !== 'incoming_message_received') {
      return {
        nextState: CONVERSATION_STATES.SELECTING_SPECIALTY,
        outboundMessages: [],
      };
    }

    if (offeredSpecialties.length === 0) {
      return {
        nextState: CONVERSATION_STATES.MAIN_MENU,
        outboundMessages: [
          {
            type: 'text',
            body: 'No encontramos especialidades activas para continuar. Volvamos al menu principal.',
          },
        ],
      };
    }

    if (
      event.messageType === 'interactive' &&
      event.interactiveReplyId === PENDING_APPOINTMENT_BLOCK_OPTION_IDS.BACK_TO_SPECIALTIES
    ) {
      return {
        nextState: CONVERSATION_STATES.SELECTING_SPECIALTY,
        outboundMessages: [this.specialtyListFactory.build(offeredSpecialties)],
      };
    }

    const specialtyCode = parseSpecialtyOptionId(event.interactiveReplyId ?? '');
    if (!specialtyCode) {
      return {
        nextState: CONVERSATION_STATES.SELECTING_SPECIALTY,
        outboundMessages: [this.specialtyListFactory.build(offeredSpecialties)],
      };
    }

    const selectedSpecialty = offeredSpecialties.find((specialty) => specialty.code === specialtyCode);
    if (!selectedSpecialty) {
      return {
        nextState: CONVERSATION_STATES.SELECTING_SPECIALTY,
        outboundMessages: [this.specialtyListFactory.build(offeredSpecialties)],
      };
    }

    await this.auditService.record('conversation.specialty.selected', {
      conversationKey: session.conversationKey,
      specialtyCode: selectedSpecialty.code,
      specialtyName: selectedSpecialty.name,
    });

    await this.auditService.record('appointment.pending_by_specialty.check.started', {
      conversationKey: session.conversationKey,
      patientId: session.context?.patientValidation?.patientId ?? null,
      specialtyCode: selectedSpecialty.code,
      specialtyCups: selectedSpecialty.cups ?? null,
    });

    const pendingAppointmentResult =
      await this.findNearestPendingFutureAppointmentByPatientAndSpecialty.execute({
        patientId: session.context?.patientValidation?.patientId ?? null,
        specialtyCups: selectedSpecialty.cups ?? null,
      });

    if (pendingAppointmentResult.status === 'TECHNICAL_FAILURE') {
      await this.auditService.record('appointment.pending_by_specialty.check.failed', {
        conversationKey: session.conversationKey,
        patientId: session.context?.patientValidation?.patientId ?? null,
        specialtyCode: selectedSpecialty.code,
        specialtyCups: selectedSpecialty.cups ?? null,
        errorMessage: pendingAppointmentResult.reason,
      });

      return {
        nextState: CONVERSATION_STATES.MAIN_MENU,
        nextContext: {
          ...session.context,
          specialtySelection: {
            ...session.context?.specialtySelection,
            offeredSpecialties,
            selectedSpecialty,
          },
          appointmentDateSelection: undefined,
          appointmentTimeSelection: undefined,
        },
        outboundMessages: [this.appointmentAvailabilityMessageFactory.buildTechnicalFailure()],
      };
    }

    if (pendingAppointmentResult.status === 'FOUND') {
      await this.auditService.record('appointment.pending_by_specialty.check.blocked', {
        conversationKey: session.conversationKey,
        patientId: session.context?.patientValidation?.patientId ?? null,
        specialtyCode: selectedSpecialty.code,
        specialtyCups: selectedSpecialty.cups ?? null,
        slotRef: pendingAppointmentResult.appointment.slotRef,
        appointmentDate: pendingAppointmentResult.appointment.appointmentDateIso,
        appointmentTime: pendingAppointmentResult.appointment.appointmentTimeHHmm,
      });

      return {
        nextState: CONVERSATION_STATES.SELECTING_SPECIALTY,
        nextContext: {
          ...session.context,
          specialtySelection: {
            ...session.context?.specialtySelection,
            offeredSpecialties,
            selectedSpecialty,
          },
          appointmentDateSelection: undefined,
          appointmentTimeSelection: undefined,
        },
        outboundMessages: [
          this.pendingAppointmentBlockMessageFactory.build({
            patientName: pendingAppointmentResult.appointment.patientFullName,
            specialtyName: selectedSpecialty.name,
            modality: pendingAppointmentResult.appointment.modality,
            appointmentDateIso: pendingAppointmentResult.appointment.appointmentDateIso,
            appointmentDisplayTime: pendingAppointmentResult.appointment.appointmentDisplayTime,
            professionalName: pendingAppointmentResult.appointment.professionalName,
            siteName: pendingAppointmentResult.appointment.siteName,
            siteAddress: pendingAppointmentResult.appointment.siteAddress,
          }),
        ],
      };
    }

    await this.auditService.record('appointment.pending_by_specialty.check.clear', {
      conversationKey: session.conversationKey,
      patientId: session.context?.patientValidation?.patientId ?? null,
      specialtyCode: selectedSpecialty.code,
      specialtyCups: selectedSpecialty.cups ?? null,
    });

    try {
      const availabilityResult = await this.resolveAvailableAppointmentDatesBySpecialty.execute({
        specialtyCups: selectedSpecialty.cups ?? null,
      });

      if (!availabilityResult.hasAvailability) {
        await this.auditService.record('appointment.availability.empty', {
          conversationKey: session.conversationKey,
          specialtyCode: selectedSpecialty.code,
          specialtyCups: selectedSpecialty.cups ?? null,
          reason: availabilityResult.reason,
        });

        return {
          nextState: CONVERSATION_STATES.MAIN_MENU,
          nextContext: {
            ...session.context,
            specialtySelection: {
              ...session.context?.specialtySelection,
              offeredSpecialties,
              selectedSpecialty,
            },
            appointmentDateSelection: undefined,
            appointmentTimeSelection: undefined,
          },
          outboundMessages: [this.appointmentAvailabilityMessageFactory.buildNoAvailability()],
        };
      }

      await this.auditService.record('appointment.availability.resolved', {
        conversationKey: session.conversationKey,
        specialtyCode: selectedSpecialty.code,
        specialtyCups: selectedSpecialty.cups ?? null,
        availableDateCount: availabilityResult.dates.length,
      });

      return {
        nextState: CONVERSATION_STATES.SELECTING_APPOINTMENT_DATE,
        nextContext: {
          ...session.context,
          specialtySelection: {
            ...session.context?.specialtySelection,
            offeredSpecialties,
            selectedSpecialty,
          },
          appointmentDateSelection: {
            offeredDates: availabilityResult.dates,
          },
          appointmentTimeSelection: undefined,
        },
        outboundMessages: [this.appointmentDateListFactory.build(availabilityResult.dates)],
      };
    } catch (error) {
      await this.auditService.record('appointment.availability.failed', {
        conversationKey: session.conversationKey,
        specialtyCode: selectedSpecialty.code,
        specialtyCups: selectedSpecialty.cups ?? null,
        errorMessage: error instanceof Error ? error.message : 'UNKNOWN_ERROR',
      });

      return {
        nextState: CONVERSATION_STATES.MAIN_MENU,
        nextContext: {
          ...session.context,
          specialtySelection: {
            ...session.context?.specialtySelection,
            offeredSpecialties,
            selectedSpecialty,
          },
          appointmentDateSelection: undefined,
          appointmentTimeSelection: undefined,
        },
        outboundMessages: [this.appointmentAvailabilityMessageFactory.buildTechnicalFailure()],
      };
    }
  }
}
