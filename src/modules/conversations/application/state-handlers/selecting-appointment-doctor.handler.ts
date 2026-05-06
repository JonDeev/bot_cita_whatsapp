import { Injectable } from '@nestjs/common';
import { ResolveAvailableAppointmentDatesBySpecialtyUseCase } from '../../../appointments/application/use-cases/resolve-available-appointment-dates-by-specialty.use-case';
import { AuditService } from '../../../audit/application/services/audit.service';
import type { NormalizedWhatsappEvent } from '../../../whatsapp/domain/events/normalized-whatsapp.event';
import { CONVERSATION_STATES } from '../../domain/conversation-state';
import type { ConversationSession } from '../../domain/entities/conversation-session.entity';
import { AppointmentDoctorListFactory } from '../services/appointment-doctor-list.factory';
import { AppointmentDateListFactory } from '../services/appointment-date-list.factory';
import { parseAppointmentDoctorOptionId } from '../services/appointment-doctor-option-id';
import type {
  ConversationStateHandler,
  ConversationStateHandlerResult,
} from './conversation-state-handler';

@Injectable()
export class SelectingAppointmentDoctorHandler implements ConversationStateHandler {
  readonly state = CONVERSATION_STATES.SELECTING_APPOINTMENT_DOCTOR;

  constructor(
    private readonly appointmentDoctorListFactory: AppointmentDoctorListFactory,
    private readonly appointmentDateListFactory: AppointmentDateListFactory,
    private readonly resolveAvailableAppointmentDatesBySpecialty: ResolveAvailableAppointmentDatesBySpecialtyUseCase,
    private readonly auditService: AuditService,
  ) {}

  async handle(
    session: ConversationSession,
    event: NormalizedWhatsappEvent,
  ): Promise<ConversationStateHandlerResult> {
    const offeredDoctors = session.context?.appointmentDoctorSelection?.offeredDoctors ?? [];

    if (event.kind !== 'incoming_message_received') {
      return {
        nextState: CONVERSATION_STATES.SELECTING_APPOINTMENT_DOCTOR,
        outboundMessages: [],
      };
    }

    if (offeredDoctors.length === 0) {
      return this.buildSpecialtyDateFallback(session);
    }

    const selectedDoctorEmployeeCode = parseAppointmentDoctorOptionId(event.interactiveReplyId ?? '');
    if (!selectedDoctorEmployeeCode) {
      return {
        nextState: CONVERSATION_STATES.SELECTING_APPOINTMENT_DOCTOR,
        outboundMessages: [this.appointmentDoctorListFactory.build(offeredDoctors)],
      };
    }

    const selectedDoctor = offeredDoctors.find(
      (doctor) => doctor.employeeCode === selectedDoctorEmployeeCode,
    );
    if (!selectedDoctor) {
      return {
        nextState: CONVERSATION_STATES.SELECTING_APPOINTMENT_DOCTOR,
        outboundMessages: [this.appointmentDoctorListFactory.build(offeredDoctors)],
      };
    }

    await this.auditService.record('conversation.appointment_doctor.selected', {
      conversationKey: session.conversationKey,
      specialtyCode: session.context?.specialtySelection?.selectedSpecialty?.code,
      specialtyCups: session.context?.specialtySelection?.selectedSpecialty?.cups ?? null,
      doctorEmployeeCode: selectedDoctor.employeeCode,
      doctorDisplayName: selectedDoctor.displayName,
    });

    try {
      const availabilityResult = await this.resolveAvailableAppointmentDatesBySpecialty.execute({
        specialtyCups: session.context?.specialtySelection?.selectedSpecialty?.cups ?? null,
        doctorEmployeeCode: selectedDoctor.employeeCode,
      });

      if (!availabilityResult.hasAvailability) {
        await this.auditService.record('appointment.availability.doctor_dates.empty', {
          conversationKey: session.conversationKey,
          specialtyCode: session.context?.specialtySelection?.selectedSpecialty?.code,
          specialtyCups: session.context?.specialtySelection?.selectedSpecialty?.cups ?? null,
          doctorEmployeeCode: selectedDoctor.employeeCode,
          reason: availabilityResult.reason,
        });

        return {
          nextState: CONVERSATION_STATES.SELECTING_APPOINTMENT_DOCTOR,
          nextContext: {
            ...session.context,
            appointmentDoctorSelection: {
              offeredDoctors,
              selectedDoctor: undefined,
            },
            appointmentTimeSelection: undefined,
          },
          outboundMessages: [
            {
              type: 'text',
              body: 'No encontramos fechas disponibles para el medico seleccionado. Elige otro medico para continuar.',
            },
            this.appointmentDoctorListFactory.build(offeredDoctors),
          ],
        };
      }

      await this.auditService.record('appointment.availability.doctor_dates.resolved', {
        conversationKey: session.conversationKey,
        specialtyCode: session.context?.specialtySelection?.selectedSpecialty?.code,
        specialtyCups: session.context?.specialtySelection?.selectedSpecialty?.cups ?? null,
        doctorEmployeeCode: selectedDoctor.employeeCode,
        availableDateCount: availabilityResult.dates.length,
      });

      const specialtyOfferedDates =
        session.context?.appointmentDateSelection?.specialtyOfferedDates ??
        session.context?.appointmentDateSelection?.offeredDates ??
        [];

      return {
        nextState: CONVERSATION_STATES.SELECTING_APPOINTMENT_DATE,
        nextContext: {
          ...session.context,
          appointmentDoctorSelection: {
            offeredDoctors,
            selectedDoctor,
          },
          appointmentDateSelection: {
            scope: 'DOCTOR',
            specialtyOfferedDates,
            offeredDates: availabilityResult.dates,
          },
          appointmentTimeSelection: undefined,
        },
        outboundMessages: [this.appointmentDateListFactory.build(availabilityResult.dates)],
      };
    } catch (error) {
      await this.auditService.record('appointment.availability.doctor_dates.failed', {
        conversationKey: session.conversationKey,
        specialtyCode: session.context?.specialtySelection?.selectedSpecialty?.code,
        specialtyCups: session.context?.specialtySelection?.selectedSpecialty?.cups ?? null,
        doctorEmployeeCode: selectedDoctor.employeeCode,
        errorMessage: error instanceof Error ? error.message : 'UNKNOWN_ERROR',
      });

      return this.buildSpecialtyDateFallback(
        session,
        'En este momento no podemos consultar la agenda del medico seleccionado. Intenta nuevamente desde las fechas disponibles.',
      );
    }
  }

  private buildSpecialtyDateFallback(
    session: ConversationSession,
    message = 'No encontramos medicos disponibles para continuar. Volvamos a las fechas disponibles.',
  ): ConversationStateHandlerResult {
    const specialtyOfferedDates =
      session.context?.appointmentDateSelection?.specialtyOfferedDates ??
      session.context?.appointmentDateSelection?.offeredDates ??
      [];

    if (specialtyOfferedDates.length === 0) {
      return {
        nextState: CONVERSATION_STATES.MAIN_MENU,
        outboundMessages: [
          {
            type: 'text',
            body: 'No encontramos fechas disponibles para continuar. Volvamos al menu principal.',
          },
        ],
      };
    }

    return {
      nextState: CONVERSATION_STATES.SELECTING_APPOINTMENT_DATE,
      nextContext: {
        ...session.context,
        appointmentDoctorSelection: session.context?.appointmentDoctorSelection
          ? {
              offeredDoctors: session.context.appointmentDoctorSelection.offeredDoctors,
              selectedDoctor: undefined,
            }
          : undefined,
        appointmentDateSelection: {
          scope: 'SPECIALTY',
          specialtyOfferedDates,
          offeredDates: specialtyOfferedDates,
          selectedDateIso: undefined,
        },
        appointmentTimeSelection: undefined,
      },
      outboundMessages: [
        {
          type: 'text',
          body: message,
        },
        this.appointmentDateListFactory.build(specialtyOfferedDates, {
          includeChooseDoctor: true,
        }),
      ],
    };
  }
}
