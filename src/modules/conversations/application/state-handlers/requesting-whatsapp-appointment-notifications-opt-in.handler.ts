import { Injectable } from '@nestjs/common';
import { RegisterWhatsappPostBookingConsentUseCase } from '../../../patients/application/use-cases/register-whatsapp-post-booking-consent.use-case';
import { AuditService } from '../../../audit/application/services/audit.service';
import type { NormalizedWhatsappEvent } from '../../../whatsapp/domain/events/normalized-whatsapp.event';
import { CONVERSATION_STATES } from '../../domain/conversation-state';
import type { ConversationSession } from '../../domain/entities/conversation-session.entity';
import {
  APPOINTMENT_NOTIFICATION_OPT_IN_TEXT,
  AppointmentNotificationOptInMessageFactory,
} from '../services/appointment-notification-opt-in-message.factory';
import {
  APPOINTMENT_NOTIFICATION_OPT_IN_OPTION_IDS,
  isAppointmentNotificationOptInOptionId,
} from '../services/appointment-notification-opt-in-option-id';
import { MainMenuListFactory } from '../services/main-menu-list.factory';
import type {
  ConversationStateHandler,
  ConversationStateHandlerResult,
} from './conversation-state-handler';

interface ResolvedConsentDecision {
  granted: boolean;
}

@Injectable()
export class RequestingWhatsappAppointmentNotificationsOptInHandler implements ConversationStateHandler {
  readonly state =
    CONVERSATION_STATES.REQUESTING_WHATSAPP_APPOINTMENT_NOTIFICATIONS_OPT_IN;

  constructor(
    private readonly appointmentNotificationOptInMessageFactory: AppointmentNotificationOptInMessageFactory,
    private readonly registerWhatsappPostBookingConsent: RegisterWhatsappPostBookingConsentUseCase,
    private readonly mainMenuListFactory: MainMenuListFactory,
    private readonly auditService: AuditService,
  ) {}

  async handle(
    session: ConversationSession,
    event: NormalizedWhatsappEvent,
  ): Promise<ConversationStateHandlerResult> {
    if (event.kind !== 'incoming_message_received') {
      return {
        nextState: this.state,
        outboundMessages: [],
      };
    }

    const decision = this.resolveConsentDecision(event);
    if (!decision) {
      return {
        nextState: this.state,
        outboundMessages: [
          this.appointmentNotificationOptInMessageFactory.build(),
        ],
      };
    }

    const patientId = session.context?.patientValidation?.patientId;
    const consentResult = await this.registerWhatsappPostBookingConsent.execute(
      {
        patientId,
        phone: session.participantPhone,
        granted: decision.granted,
        consentTextSnapshot: APPOINTMENT_NOTIFICATION_OPT_IN_TEXT,
        respondedAtIso: event.receivedAt,
      },
    );

    await this.auditService.record('conversation.whatsapp_opt_in.responded', {
      conversationKey: session.conversationKey,
      patientId: patientId ?? null,
      granted: decision.granted,
      persistenceStatus: consentResult.status,
      persistenceReason:
        consentResult.status === 'SKIPPED' ? consentResult.reason : null,
    });

    const responseMessage = decision.granted
      ? 'Gracias. Registramos tu autorizacion para enviarte notificaciones de citas y encuestas de satisfaccion por WhatsApp.'
      : 'Gracias. Registramos que no autorizas notificaciones de citas ni encuestas de satisfaccion por WhatsApp.';

    return {
      nextState: CONVERSATION_STATES.MAIN_MENU,
      nextContext: {
        ...session.context,
        flowIntent: undefined,
        contactVerification: undefined,
        assignedAppointmentSelection: undefined,
        appointmentReschedule: undefined,
        specialtySelection: undefined,
        appointmentDoctorSelection: undefined,
        appointmentDateSelection: undefined,
        appointmentTimeSelection: undefined,
      },
      outboundMessages: [
        {
          type: 'text',
          body: responseMessage,
        },
        this.mainMenuListFactory.build(),
      ],
    };
  }

  private resolveConsentDecision(
    event: Extract<
      NormalizedWhatsappEvent,
      { kind: 'incoming_message_received' }
    >,
  ): ResolvedConsentDecision | null {
    if (
      event.messageType === 'interactive' &&
      isAppointmentNotificationOptInOptionId(event.interactiveReplyId)
    ) {
      return {
        granted:
          event.interactiveReplyId ===
          APPOINTMENT_NOTIFICATION_OPT_IN_OPTION_IDS.ACCEPT,
      };
    }

    const normalizedText = (event.textBody ?? '').trim().toLowerCase();
    if (normalizedText === '1' || normalizedText === 'si') {
      return { granted: true };
    }

    if (normalizedText === '2' || normalizedText === 'no') {
      return { granted: false };
    }

    return null;
  }
}
