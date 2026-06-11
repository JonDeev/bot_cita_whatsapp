import { Injectable } from '@nestjs/common';
import { RegisterWhatsappPostBookingConsentUseCase } from '../../../patients/application/use-cases/register-whatsapp-post-booking-consent.use-case';
import { AuditService } from '../../../audit/application/services/audit.service';
import type { NormalizedWhatsappEvent } from '../../../whatsapp/domain/events/normalized-whatsapp.event';
import { CONVERSATION_STATES } from '../../domain/conversation-state';
import { CONVERSATION_STATUSES } from '../../domain/conversation-status';
import type { ConversationSession } from '../../domain/entities/conversation-session.entity';
import {
  ConsentPhoneResolverService,
  type ConsentPhoneResolutionResult,
} from '../services/consent-phone-resolver.service';
import {
  APPOINTMENT_NOTIFICATION_OPT_IN_TEXT,
  AppointmentNotificationOptInMessageFactory,
} from '../services/appointment-notification-opt-in-message.factory';
import {
  APPOINTMENT_NOTIFICATION_OPT_IN_OPTION_IDS,
  isAppointmentNotificationOptInOptionId,
} from '../services/appointment-notification-opt-in-option-id';
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
    private readonly consentPhoneResolver: ConsentPhoneResolverService,
    private readonly registerWhatsappPostBookingConsent: RegisterWhatsappPostBookingConsentUseCase,
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
    const consentPhoneResolution = this.consentPhoneResolver.resolve(session);
    const consentResult = await this.persistConsent({
      consentPhoneResolution,
      conversationKey: session.conversationKey,
      patientId,
      granted: decision.granted,
      respondedAtIso: event.receivedAt,
    });

    await this.auditService.record('conversation.whatsapp_opt_in.responded', {
      conversationKey: session.conversationKey,
      patientId: patientId ?? null,
      granted: decision.granted,
      persistenceStatus: consentResult.status,
      consentPhoneSource:
        consentPhoneResolution.status === 'FOUND' ? 'SNAPSHOT' : 'MISSING',
      persistenceReason:
        consentResult.status === 'SKIPPED' ? consentResult.reason : null,
    });

    const responseMessage = this.buildResponseMessage({
      granted: decision.granted,
      persistenceStatus: consentResult.status,
    });

    if (session.context?.flowIntent && session.context.flowIntent !== 'UPDATE_CONTACT') {
      await this.auditService.record(
        'conversation.continued.after_opt_in_response',
        {
          conversationKey: session.conversationKey,
          patientId: patientId ?? null,
          flowIntent: session.context.flowIntent,
        },
      );

      return {
        nextState: CONVERSATION_STATES.PATIENT_VALIDATED,
        nextContext: {
          ...session.context,
          appointmentNotificationsConsentPhone: undefined,
          contactVerification: session.context.contactVerification
            ? {
                ...session.context.contactVerification,
                completedForCurrentFlow: true,
                pendingPhone: undefined,
                verifiedPhone: undefined,
                selectedUpdateMode: undefined,
                invalidPhoneAttempts: 0,
                invalidEmailAttempts: 0,
              }
            : undefined,
        },
        outboundMessages: [
          {
            type: 'text',
            body: responseMessage,
          },
        ],
      };
    }

    await this.auditService.record('conversation.closed.by_patient', {
      conversationKey: session.conversationKey,
      patientId: patientId ?? null,
    });

    return {
      nextState: CONVERSATION_STATES.MAIN_MENU,
      nextStatus: CONVERSATION_STATUSES.CLOSED,
      nextContext: {
        ...session.context,
        flowIntent: undefined,
        appointmentNotificationsConsentPhone: undefined,
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
      ],
    };
  }

  private async persistConsent(input: {
    consentPhoneResolution: ConsentPhoneResolutionResult;
    conversationKey: string;
    patientId: number | null | undefined;
    granted: boolean;
    respondedAtIso: string | undefined;
  }) {
    if (input.consentPhoneResolution.status === 'NONE') {
      await this.auditService.record(
        'conversation.whatsapp_opt_in.phone_missing',
        {
          conversationKey: input.conversationKey,
          patientId: input.patientId ?? null,
        },
      );

      return {
        status: 'SKIPPED' as const,
        reason: 'MISSING_CONSENT_PHONE' as const,
      };
    }

    return this.registerWhatsappPostBookingConsent.execute({
      patientId: input.patientId,
      phone: input.consentPhoneResolution.phone,
      granted: input.granted,
      consentTextSnapshot: APPOINTMENT_NOTIFICATION_OPT_IN_TEXT,
      respondedAtIso: input.respondedAtIso,
    });
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

  private buildResponseMessage(input: {
    granted: boolean;
    persistenceStatus: 'RECORDED' | 'SKIPPED';
  }): string {
    if (input.persistenceStatus === 'SKIPPED') {
      return 'Gracias por tu respuesta. Continuaremos con tu solicitud, pero no pudimos registrar esta preferencia en este momento.';
    }

    if (input.granted) {
      return 'Gracias. Registramos tu autorizacion para enviarte notificaciones de citas y encuestas de satisfaccion por WhatsApp.';
    }

    return 'Gracias. Registramos que no autorizas notificaciones de citas ni encuestas de satisfaccion por WhatsApp.';
  }
}
