import { Injectable } from '@nestjs/common';
import { ResolveAvailableAppointmentTimesBySpecialtyAndDateUseCase } from '../../../appointments/application/use-cases/resolve-available-appointment-times-by-specialty-and-date.use-case';
import { AuditService } from '../../../audit/application/services/audit.service';
import type { NormalizedWhatsappEvent } from '../../../whatsapp/domain/events/normalized-whatsapp.event';
import { CONVERSATION_STATES } from '../../domain/conversation-state';
import type { ConversationSession } from '../../domain/entities/conversation-session.entity';
import { AppointmentAvailabilityMessageFactory } from '../services/appointment-availability-message.factory';
import { AppointmentDateListFactory } from '../services/appointment-date-list.factory';
import { AppointmentTimeListFactory } from '../services/appointment-time-list.factory';
import { parseAppointmentDateOptionId } from '../services/appointment-date-option-id';
import type {
  ConversationStateHandler,
  ConversationStateHandlerResult,
} from './conversation-state-handler';

@Injectable()
export class SelectingAppointmentDateHandler implements ConversationStateHandler {
  readonly state = CONVERSATION_STATES.SELECTING_APPOINTMENT_DATE;

  constructor(
    private readonly appointmentDateListFactory: AppointmentDateListFactory,
    private readonly appointmentTimeListFactory: AppointmentTimeListFactory,
    private readonly appointmentAvailabilityMessageFactory: AppointmentAvailabilityMessageFactory,
    private readonly resolveAvailableAppointmentTimesBySpecialtyAndDate: ResolveAvailableAppointmentTimesBySpecialtyAndDateUseCase,
    private readonly auditService: AuditService,
  ) {}

  async handle(
    session: ConversationSession,
    event: NormalizedWhatsappEvent,
  ): Promise<ConversationStateHandlerResult> {
    const offeredDates = session.context?.appointmentDateSelection?.offeredDates ?? [];

    if (event.kind !== 'incoming_message_received') {
      return {
        nextState: CONVERSATION_STATES.SELECTING_APPOINTMENT_DATE,
        outboundMessages: [],
      };
    }

    if (offeredDates.length === 0) {
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

    const selectedDateIso = parseAppointmentDateOptionId(event.interactiveReplyId ?? '');
    if (!selectedDateIso) {
      return {
        nextState: CONVERSATION_STATES.SELECTING_APPOINTMENT_DATE,
        outboundMessages: [this.appointmentDateListFactory.build(offeredDates)],
      };
    }

    const selectedDate = offeredDates.find((date) => date.isoDate === selectedDateIso);
    if (!selectedDate) {
      return {
        nextState: CONVERSATION_STATES.SELECTING_APPOINTMENT_DATE,
        outboundMessages: [this.appointmentDateListFactory.build(offeredDates)],
      };
    }

    await this.auditService.record('conversation.appointment_date.selected', {
      conversationKey: session.conversationKey,
      specialtyCode: session.context?.specialtySelection?.selectedSpecialty?.code,
      specialtyCups: session.context?.specialtySelection?.selectedSpecialty?.cups ?? null,
      appointmentDate: selectedDate.isoDate,
    });

    try {
      const selectedSpecialty = session.context?.specialtySelection?.selectedSpecialty;
      const availabilityResult =
        await this.resolveAvailableAppointmentTimesBySpecialtyAndDate.execute({
          specialtyCups: selectedSpecialty?.cups ?? null,
          appointmentDateIso: selectedDate.isoDate,
        });

      if (!availabilityResult.hasAvailability) {
        await this.auditService.record('appointment.availability.times.empty', {
          conversationKey: session.conversationKey,
          specialtyCode: selectedSpecialty?.code,
          specialtyCups: selectedSpecialty?.cups ?? null,
          appointmentDate: selectedDate.isoDate,
          reason: availabilityResult.reason,
        });

        return {
          nextState: CONVERSATION_STATES.SELECTING_APPOINTMENT_DATE,
          nextContext: {
            ...session.context,
            appointmentDateSelection: {
              offeredDates,
              selectedDateIso: selectedDate.isoDate,
            },
            appointmentTimeSelection: undefined,
          },
          outboundMessages: [
            {
              type: 'text',
              body: this.appointmentAvailabilityMessageFactory.buildNoTimeAvailabilityForSelectedDate(
                selectedDate.displayDate,
              ),
            },
            this.appointmentDateListFactory.build(offeredDates),
          ],
        };
      }

      await this.auditService.record('appointment.availability.times.resolved', {
        conversationKey: session.conversationKey,
        specialtyCode: selectedSpecialty?.code,
        specialtyCups: selectedSpecialty?.cups ?? null,
        appointmentDate: selectedDate.isoDate,
        availableTimeCount: availabilityResult.times.length,
      });

      return {
        nextState: CONVERSATION_STATES.SELECTING_APPOINTMENT_TIME,
        nextContext: {
          ...session.context,
          appointmentDateSelection: {
            offeredDates,
            selectedDateIso: selectedDate.isoDate,
          },
          appointmentTimeSelection: {
            offeredTimes: availabilityResult.times,
            hasMoreTimes: availabilityResult.hasMore,
            nextCursorTimeHHmm: availabilityResult.nextCursorTimeHHmm,
          },
        },
        outboundMessages: [
          this.appointmentTimeListFactory.build(
            availabilityResult.times,
            availabilityResult.hasMore,
          ),
        ],
      };
    } catch (error) {
      await this.auditService.record('appointment.availability.times.failed', {
        conversationKey: session.conversationKey,
        specialtyCode: session.context?.specialtySelection?.selectedSpecialty?.code,
        specialtyCups: session.context?.specialtySelection?.selectedSpecialty?.cups ?? null,
        appointmentDate: selectedDate.isoDate,
        errorMessage: error instanceof Error ? error.message : 'UNKNOWN_ERROR',
      });

      return {
        nextState: CONVERSATION_STATES.MAIN_MENU,
        nextContext: {
          ...session.context,
          appointmentDateSelection: {
            offeredDates,
            selectedDateIso: selectedDate.isoDate,
          },
          appointmentTimeSelection: undefined,
        },
        outboundMessages: [this.appointmentAvailabilityMessageFactory.buildTechnicalFailure()],
      };
    }
  }
}
