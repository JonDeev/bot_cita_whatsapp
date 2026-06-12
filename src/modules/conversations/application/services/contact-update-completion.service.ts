import { Injectable } from '@nestjs/common';
import { ResolveWhatsappAppointmentNotificationsOptInGateUseCase } from '../../../patients/application/use-cases/resolve-whatsapp-appointment-notifications-opt-in-gate.use-case';
import type { ConversationStateHandlerResult } from '../state-handlers/conversation-state-handler';
import type { ConversationSession } from '../../domain/entities/conversation-session.entity';
import { CONVERSATION_STATES } from '../../domain/conversation-state';
import { CONVERSATION_STATUSES } from '../../domain/conversation-status';
import type { ConversationOutboundMessage } from '../../domain/value-objects/conversation-outbound-message';
import { AppointmentNotificationOptInMessageFactory } from './appointment-notification-opt-in-message.factory';
import { PrimaryFlowContinuationResolverService } from './primary-flow-continuation-resolver.service';

@Injectable()
export class ContactUpdateCompletionService {
  constructor(
    private readonly resolveWhatsappAppointmentNotificationsOptInGate: ResolveWhatsappAppointmentNotificationsOptInGateUseCase,
    private readonly appointmentNotificationOptInMessageFactory: AppointmentNotificationOptInMessageFactory,
    private readonly primaryFlowContinuationResolver: PrimaryFlowContinuationResolverService,
  ) {}

  async buildResult(input: {
    session: ConversationSession;
    verifiedPhone: string;
    successMessage: ConversationOutboundMessage;
  }): Promise<ConversationStateHandlerResult> {
    const contactVerification = input.session.context?.contactVerification;
    const verifiedPhone = input.verifiedPhone.trim();
    const patientId = input.session.context?.patientValidation?.patientId ?? null;

    const optInGateResult =
      await this.resolveWhatsappAppointmentNotificationsOptInGate.execute({
        patientId,
        whatsappPhone: verifiedPhone,
      });

    if (optInGateResult.status === 'PROMPT_REQUIRED') {
      return {
        nextState:
          CONVERSATION_STATES.REQUESTING_WHATSAPP_APPOINTMENT_NOTIFICATIONS_OPT_IN,
        nextContext: {
          ...input.session.context,
          appointmentNotificationsConsentPhone: verifiedPhone,
          contactVerification: contactVerification
            ? {
                ...contactVerification,
                completedForCurrentFlow: true,
                pendingPhone: undefined,
                verifiedPhone,
                requiresPhoneRevalidation: false,
                phoneRevalidationReasons: [],
              }
            : undefined,
        },
        outboundMessages: [
          input.successMessage,
          this.appointmentNotificationOptInMessageFactory.build(),
        ],
      };
    }

    if (input.session.context?.flowIntent === 'UPDATE_CONTACT') {
      return {
        nextState: CONVERSATION_STATES.MAIN_MENU,
        nextStatus: CONVERSATION_STATUSES.CLOSED,
        nextContext: {
          ...input.session.context,
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
        outboundMessages: [input.successMessage],
      };
    }

    return {
      nextState: CONVERSATION_STATES.PATIENT_VALIDATED,
      nextContext: {
        ...input.session.context,
        appointmentNotificationsConsentPhone: undefined,
        contactVerification: contactVerification
          ? {
              ...contactVerification,
              completedForCurrentFlow: true,
              pendingPhone: undefined,
              verifiedPhone: undefined,
              requiresPhoneRevalidation: false,
              phoneRevalidationReasons: [],
            }
          : undefined,
      },
      outboundMessages: [input.successMessage],
      continueFlow: this.primaryFlowContinuationResolver.shouldContinue(
        input.session,
      ),
    };
  }
}
