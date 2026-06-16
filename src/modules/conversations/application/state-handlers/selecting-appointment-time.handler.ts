import { Injectable } from '@nestjs/common';
import { AssignAppointmentSlotAfterTimeSelectionUseCase } from '../../../appointments/application/use-cases/assign-appointment-slot-after-time-selection.use-case';
import { ResolveAvailableAppointmentTimesBySpecialtyAndDateUseCase } from '../../../appointments/application/use-cases/resolve-available-appointment-times-by-specialty-and-date.use-case';
import { AuditService } from '../../../audit/application/services/audit.service';
import { ResolvePostBookingWhatsappAppointmentNotificationsOptInGateUseCase } from '../../../patients/application/use-cases/resolve-post-booking-whatsapp-appointment-notifications-opt-in-gate.use-case';
import type { NormalizedWhatsappEvent } from '../../../whatsapp/domain/events/normalized-whatsapp.event';
import { CONVERSATION_STATES } from '../../domain/conversation-state';
import { CONVERSATION_STATUSES } from '../../domain/conversation-status';
import type { OfferedAppointmentTimeSessionContext } from '../../domain/entities/conversation-session-context.entity';
import type { ConversationSession } from '../../domain/entities/conversation-session.entity';
import { AppointmentAssignmentConfirmationMessageFactory } from '../services/appointment-assignment-confirmation-message.factory';
import { AppointmentAvailabilityMessageFactory } from '../services/appointment-availability-message.factory';
import { AppointmentDateListFactory } from '../services/appointment-date-list.factory';
import { AppointmentNotificationOptInMessageFactory } from '../services/appointment-notification-opt-in-message.factory';
import { AppointmentReschedulingTimeSelectionService } from '../services/appointment-rescheduling-time-selection.service';
import { AppointmentTimeListFactory } from '../services/appointment-time-list.factory';
import { MainMenuListFactory } from '../services/main-menu-list.factory';
import { parseAppointmentTimeOptionId } from '../services/appointment-time-option-id';
import type {
  ConversationStateHandler,
  ConversationStateHandlerResult,
} from './conversation-state-handler';

@Injectable()
export class SelectingAppointmentTimeHandler implements ConversationStateHandler {
  readonly state = CONVERSATION_STATES.SELECTING_APPOINTMENT_TIME;

  constructor(
    private readonly appointmentTimeListFactory: AppointmentTimeListFactory,
    private readonly appointmentDateListFactory: AppointmentDateListFactory,
    private readonly appointmentAssignmentConfirmationMessageFactory: AppointmentAssignmentConfirmationMessageFactory,
    private readonly appointmentAvailabilityMessageFactory: AppointmentAvailabilityMessageFactory,
    private readonly appointmentNotificationOptInMessageFactory: AppointmentNotificationOptInMessageFactory,
    private readonly mainMenuListFactory: MainMenuListFactory,
    private readonly appointmentReschedulingTimeSelectionService: AppointmentReschedulingTimeSelectionService,
    private readonly resolveAvailableAppointmentTimesBySpecialtyAndDate: ResolveAvailableAppointmentTimesBySpecialtyAndDateUseCase,
    private readonly assignAppointmentSlotAfterTimeSelection: AssignAppointmentSlotAfterTimeSelectionUseCase,
    private readonly resolvePostBookingWhatsappAppointmentNotificationsOptInGate: ResolvePostBookingWhatsappAppointmentNotificationsOptInGateUseCase,
    private readonly auditService: AuditService,
  ) {}

  async handle(
    session: ConversationSession,
    event: NormalizedWhatsappEvent,
  ): Promise<ConversationStateHandlerResult> {
    const offeredTimes =
      session.context?.appointmentTimeSelection?.offeredTimes ?? [];
    const hasMoreTimes =
      session.context?.appointmentTimeSelection?.hasMoreTimes ?? false;
    const nextCursorTimeHHmm =
      session.context?.appointmentTimeSelection?.nextCursorTimeHHmm;

    if (event.kind !== 'incoming_message_received') {
      return {
        nextState: CONVERSATION_STATES.SELECTING_APPOINTMENT_TIME,
        outboundMessages: [],
      };
    }

    if (offeredTimes.length === 0) {
      return {
        nextState: CONVERSATION_STATES.MAIN_MENU,
        outboundMessages: [
          {
            type: 'text',
            body: 'No encontramos horas disponibles para continuar. Volvamos al menu principal.',
          },
        ],
      };
    }

    const selectedSlotRef = parseAppointmentTimeOptionId(
      event.interactiveReplyId ?? '',
    );
    if (!selectedSlotRef) {
      return {
        nextState: CONVERSATION_STATES.SELECTING_APPOINTMENT_TIME,
        outboundMessages: [
          this.appointmentTimeListFactory.build(offeredTimes, hasMoreTimes),
        ],
      };
    }

    if (selectedSlotRef.kind === 'show_more') {
      return this.handleShowMoreSelection(
        session,
        offeredTimes,
        hasMoreTimes,
        nextCursorTimeHHmm,
      );
    }

    const selectedTime = offeredTimes.find(
      (time) => time.slotRef === selectedSlotRef.slotRef,
    );
    if (!selectedTime) {
      return {
        nextState: CONVERSATION_STATES.SELECTING_APPOINTMENT_TIME,
        outboundMessages: [
          this.appointmentTimeListFactory.build(offeredTimes, hasMoreTimes),
        ],
      };
    }

    await this.auditService.record('conversation.appointment_time.selected', {
      conversationKey: session.conversationKey,
      specialtyCode:
        session.context?.specialtySelection?.selectedSpecialty?.code,
      specialtyCups:
        session.context?.specialtySelection?.selectedSpecialty?.cups ?? null,
      doctorEmployeeCode:
        session.context?.appointmentDoctorSelection?.selectedDoctor
          ?.employeeCode ?? null,
      appointmentDate:
        session.context?.appointmentDateSelection?.selectedDateIso,
      appointmentTime: selectedTime.timeHHmm,
      slotRef: selectedTime.slotRef,
    });

    if (session.context?.appointmentReschedule) {
      const rescheduleOutcome =
        await this.appointmentReschedulingTimeSelectionService.handleAfterTimeSelection(
          session,
          selectedTime,
        );

      if (rescheduleOutcome.status === 'TIME_NO_LONGER_AVAILABLE') {
        return this.rebuildTimeSelectionAfterSlotExhausted(
          session,
          rescheduleOutcome.selectedDisplayTime,
        );
      }

      return rescheduleOutcome.result;
    }

    await this.auditService.record('appointment.assignment.attempted', {
      conversationKey: session.conversationKey,
      patientId: session.context?.patientValidation?.patientId ?? null,
      specialtyCode:
        session.context?.specialtySelection?.selectedSpecialty?.code,
      specialtyCups:
        session.context?.specialtySelection?.selectedSpecialty?.cups ?? null,
      doctorEmployeeCode:
        session.context?.appointmentDoctorSelection?.selectedDoctor
          ?.employeeCode ?? null,
      appointmentDate:
        session.context?.appointmentDateSelection?.selectedDateIso ?? null,
      appointmentTime: selectedTime.timeHHmm,
      preferredSlotRef: selectedTime.slotRef,
    });

    const assignmentResult =
      await this.assignAppointmentSlotAfterTimeSelection.execute({
        patientId: session.context?.patientValidation?.patientId ?? null,
        specialtyName:
          session.context?.specialtySelection?.selectedSpecialty?.name ?? null,
        specialtyCups:
          session.context?.specialtySelection?.selectedSpecialty?.cups ?? null,
        appointmentDateIso:
          session.context?.appointmentDateSelection?.selectedDateIso ?? null,
        appointmentTimeHHmm: selectedTime.timeHHmm,
        preferredSlotRef: selectedTime.slotRef,
        doctorEmployeeCode:
          session.context?.appointmentDoctorSelection?.selectedDoctor
            ?.employeeCode ?? null,
      });

    if (assignmentResult.status === 'ASSIGNED') {
      if (assignmentResult.appointment.usedFallbackSlot) {
        await this.auditService.record(
          'appointment.assignment.primary_slot_unavailable',
          {
            conversationKey: session.conversationKey,
            preferredSlotRef: selectedTime.slotRef,
          },
        );

        await this.auditService.record(
          'appointment.assignment.fallback_slot_found',
          {
            conversationKey: session.conversationKey,
            preferredSlotRef: selectedTime.slotRef,
            assignedSlotRef: assignmentResult.appointment.slotRef,
          },
        );
      }

      await this.auditService.record('appointment.assignment.succeeded', {
        conversationKey: session.conversationKey,
        assignedSlotRef: assignmentResult.appointment.slotRef,
        usedFallbackSlot: assignmentResult.appointment.usedFallbackSlot,
      });

      const shouldPromptOptInResult =
        await this.resolvePostBookingWhatsappAppointmentNotificationsOptInGate.execute(
          {
            patientId: session.context?.patientValidation?.patientId,
          },
        );

      await this.auditService.record('conversation.whatsapp_opt_in.gate', {
        conversationKey: session.conversationKey,
        patientId: session.context?.patientValidation?.patientId ?? null,
        status: shouldPromptOptInResult.status,
        reason:
          shouldPromptOptInResult.status === 'PROMPT_REQUIRED'
            ? shouldPromptOptInResult.reason
            : null,
      });

      const confirmationMessage = {
        type: 'text' as const,
        body: this.appointmentAssignmentConfirmationMessageFactory.buildBody(
          assignmentResult.appointment,
        ),
      };

      if (shouldPromptOptInResult.status === 'PROMPT_NOT_REQUIRED') {
        await this.auditService.record(
          'conversation.closed.after_appointment_assignment',
          {
            conversationKey: session.conversationKey,
            patientId: session.context?.patientValidation?.patientId ?? null,
            appointmentDate:
              session.context?.appointmentDateSelection?.selectedDateIso ?? null,
            appointmentTime: selectedTime.timeHHmm,
            optInGateStatus: shouldPromptOptInResult.status,
          },
        );

        return {
          nextState: CONVERSATION_STATES.MAIN_MENU,
          nextStatus: CONVERSATION_STATUSES.CLOSED,
          nextContext: this.buildPostBookingNextContext(session),
          outboundMessages: [confirmationMessage],
        };
      }

      return {
        nextState:
          CONVERSATION_STATES.REQUESTING_WHATSAPP_APPOINTMENT_NOTIFICATIONS_OPT_IN,
        nextContext: this.buildPostBookingNextContext(session, {
          appointmentNotificationsConsentPhone:
            shouldPromptOptInResult.officialPhone ?? undefined,
        }),
        outboundMessages: [
          confirmationMessage,
          this.appointmentNotificationOptInMessageFactory.build(),
        ],
      };
    }

    if (assignmentResult.status === 'TIME_NO_LONGER_AVAILABLE') {
      await this.auditService.record('appointment.assignment.time_exhausted', {
        conversationKey: session.conversationKey,
        preferredSlotRef: selectedTime.slotRef,
      });

      return this.rebuildTimeSelectionAfterSlotExhausted(
        session,
        selectedTime.displayTime,
      );
    }

    await this.auditService.record('appointment.assignment.failed', {
      conversationKey: session.conversationKey,
      preferredSlotRef: selectedTime.slotRef,
      reason: assignmentResult.reason,
    });

    return {
      nextState: CONVERSATION_STATES.MAIN_MENU,
      nextContext: {
        ...session.context,
        appointmentTimeSelection: undefined,
      },
      outboundMessages: [
        this.appointmentAvailabilityMessageFactory.buildTechnicalFailure(),
      ],
    };
  }

  private async handleShowMoreSelection(
    session: ConversationSession,
    offeredTimes: OfferedAppointmentTimeSessionContext[],
    hasMoreTimes: boolean,
    nextCursorTimeHHmm: string | undefined,
  ): Promise<ConversationStateHandlerResult> {
    if (!hasMoreTimes) {
      return {
        nextState: CONVERSATION_STATES.SELECTING_APPOINTMENT_TIME,
        outboundMessages: [
          this.appointmentTimeListFactory.build(offeredTimes, false),
        ],
      };
    }

    const selectedSpecialty =
      session.context?.specialtySelection?.selectedSpecialty;
    const selectedDateIso =
      session.context?.appointmentDateSelection?.selectedDateIso;
    const cursorTimeHHmm = nextCursorTimeHHmm ?? offeredTimes.at(-1)?.timeHHmm;

    await this.auditService.record(
      'conversation.appointment_time.show_more.selected',
      {
        conversationKey: session.conversationKey,
        specialtyCode: selectedSpecialty?.code,
        specialtyCups: selectedSpecialty?.cups ?? null,
        doctorEmployeeCode:
          session.context?.appointmentDoctorSelection?.selectedDoctor
            ?.employeeCode ?? null,
        appointmentDate: selectedDateIso,
        cursorTimeHHmm: cursorTimeHHmm ?? null,
      },
    );

    try {
      const availabilityResult =
        await this.resolveAvailableAppointmentTimesBySpecialtyAndDate.execute({
          specialtyCups: selectedSpecialty?.cups ?? null,
          appointmentDateIso: selectedDateIso ?? null,
          afterTimeHHmmExclusive: cursorTimeHHmm ?? null,
          doctorEmployeeCode:
            session.context?.appointmentDoctorSelection?.selectedDoctor
              ?.employeeCode ?? null,
        });

      if (!availabilityResult.hasAvailability) {
        await this.auditService.record(
          'appointment.availability.times.page.empty',
          {
            conversationKey: session.conversationKey,
            specialtyCode: selectedSpecialty?.code,
            specialtyCups: selectedSpecialty?.cups ?? null,
            doctorEmployeeCode:
              session.context?.appointmentDoctorSelection?.selectedDoctor
                ?.employeeCode ?? null,
            appointmentDate: selectedDateIso,
            cursorTimeHHmm: cursorTimeHHmm ?? null,
            reason: availabilityResult.reason,
          },
        );

        return {
          nextState: CONVERSATION_STATES.SELECTING_APPOINTMENT_TIME,
          nextContext: {
            ...session.context,
            appointmentTimeSelection: {
              ...session.context?.appointmentTimeSelection,
              offeredTimes,
              hasMoreTimes: false,
              nextCursorTimeHHmm: undefined,
            },
          },
          outboundMessages: [
            {
              type: 'text',
              body: this.appointmentAvailabilityMessageFactory.buildNoMoreTimesForSelectedDate(),
            },
            this.appointmentTimeListFactory.build(offeredTimes, false),
          ],
        };
      }

      await this.auditService.record(
        'appointment.availability.times.page.resolved',
        {
          conversationKey: session.conversationKey,
          specialtyCode: selectedSpecialty?.code,
          specialtyCups: selectedSpecialty?.cups ?? null,
          doctorEmployeeCode:
            session.context?.appointmentDoctorSelection?.selectedDoctor
              ?.employeeCode ?? null,
          appointmentDate: selectedDateIso,
          cursorTimeHHmm: cursorTimeHHmm ?? null,
          availableTimeCount: availabilityResult.times.length,
          hasMoreTimes: availabilityResult.hasMore,
        },
      );

      return {
        nextState: CONVERSATION_STATES.SELECTING_APPOINTMENT_TIME,
        nextContext: {
          ...session.context,
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
      await this.auditService.record(
        'appointment.availability.times.page.failed',
        {
          conversationKey: session.conversationKey,
          specialtyCode: selectedSpecialty?.code,
          specialtyCups: selectedSpecialty?.cups ?? null,
          doctorEmployeeCode:
            session.context?.appointmentDoctorSelection?.selectedDoctor
              ?.employeeCode ?? null,
          appointmentDate: selectedDateIso,
          cursorTimeHHmm: cursorTimeHHmm ?? null,
          errorMessage:
            error instanceof Error ? error.message : 'UNKNOWN_ERROR',
        },
      );

      return {
        nextState: CONVERSATION_STATES.MAIN_MENU,
        nextContext: {
          ...session.context,
          appointmentTimeSelection: undefined,
        },
        outboundMessages: [
          this.appointmentAvailabilityMessageFactory.buildTechnicalFailure(),
        ],
      };
    }
  }

  private buildPostBookingNextContext(
    session: ConversationSession,
    input?: {
      appointmentNotificationsConsentPhone?: string | undefined;
    },
  ) {
    return {
      ...session.context,
      flowIntent: undefined,
      contactVerification: undefined,
      appointmentNotificationsConsentPhone:
        input?.appointmentNotificationsConsentPhone,
      appointmentReschedule: undefined,
      specialtySelection: undefined,
      appointmentDoctorSelection: undefined,
      appointmentDateSelection: undefined,
      appointmentTimeSelection: undefined,
    };
  }

  private async rebuildTimeSelectionAfterSlotExhausted(
    session: ConversationSession,
    selectedDisplayTime: string,
  ): Promise<ConversationStateHandlerResult> {
    const selectedSpecialty =
      session.context?.specialtySelection?.selectedSpecialty;
    const selectedDoctor =
      session.context?.appointmentDoctorSelection?.selectedDoctor;
    const selectedDateIso =
      session.context?.appointmentDateSelection?.selectedDateIso;
    const offeredDates =
      session.context?.appointmentDateSelection?.offeredDates ?? [];
    const selectedDateDisplay = offeredDates.find(
      (date) => date.isoDate === selectedDateIso,
    )?.displayDate;
    const isDoctorScoped =
      session.context?.appointmentDateSelection?.scope === 'DOCTOR';

    const availabilityResult =
      await this.resolveAvailableAppointmentTimesBySpecialtyAndDate.execute({
        specialtyCups: selectedSpecialty?.cups ?? null,
        appointmentDateIso: selectedDateIso ?? null,
        doctorEmployeeCode: selectedDoctor?.employeeCode ?? null,
      });

    if (!availabilityResult.hasAvailability) {
      const noAvailabilityMessage = selectedDateDisplay
        ? this.appointmentAvailabilityMessageFactory.buildNoTimeAvailabilityForSelectedDate(
            selectedDateDisplay,
          )
        : 'No encontramos horas disponibles para el dia seleccionado. Selecciona otro dia para continuar.';

      const outboundMessages: ConversationStateHandlerResult['outboundMessages'] =
        [
          {
            type: 'text',
            body: this.buildTimeNoLongerAvailableMessage(
              selectedDisplayTime,
              selectedDoctor,
              noAvailabilityMessage,
            ),
          },
        ];
      if (offeredDates.length > 0) {
        outboundMessages.push(
          this.appointmentDateListFactory.build(offeredDates, {
            includeChooseDoctor: !isDoctorScoped,
          }),
        );
      }

      return {
        nextState: CONVERSATION_STATES.SELECTING_APPOINTMENT_DATE,
        nextContext: {
          ...session.context,
          appointmentTimeSelection: undefined,
        },
        outboundMessages,
      };
    }

    return {
      nextState: CONVERSATION_STATES.SELECTING_APPOINTMENT_TIME,
      nextContext: {
        ...session.context,
        appointmentTimeSelection: {
          offeredTimes: availabilityResult.times,
          hasMoreTimes: availabilityResult.hasMore,
          nextCursorTimeHHmm: availabilityResult.nextCursorTimeHHmm,
        },
      },
      outboundMessages: [
        {
          type: 'text',
          body: this.buildTimeNoLongerAvailableMessage(
            selectedDisplayTime,
            selectedDoctor,
          ),
        },
        this.appointmentTimeListFactory.build(
          availabilityResult.times,
          availabilityResult.hasMore,
        ),
      ],
    };
  }

  private buildTimeNoLongerAvailableMessage(
    selectedDisplayTime: string,
    selectedDoctor?: {
      employeeCode: string;
      displayName: string;
    },
    suffix?: string,
  ): string {
    const contextualMessage = selectedDoctor
      ? `Ese cupo ya fue ocupado por otro paciente. ${
          suffix ??
          `Te mostramos las horas disponibles del medico ${selectedDoctor.displayName} para la fecha seleccionada.`
        }`
      : 'La hora seleccionada ya no se encuentra disponible. Por favor elige otra hora del listado.';
    const continuationSuffix = selectedDoctor
      ? contextualMessage
      : (suffix ?? contextualMessage);

    return `La hora ${selectedDisplayTime} ya no se encuentra disponible. ${continuationSuffix}`;
  }
}
