import { Injectable } from '@nestjs/common';
import type { NormalizedWhatsappEvent } from '../../../whatsapp/domain/events/normalized-whatsapp.event';
import { CONVERSATION_STATES } from '../../domain/conversation-state';
import type { ConversationSession } from '../../domain/entities/conversation-session.entity';
import { PatientIdentityInputNormalizerService } from '../../../patients/application/services/patient-identity-input-normalizer.service';
import type {
  ConversationStateHandler,
  ConversationStateHandlerResult,
} from './conversation-state-handler';

@Injectable()
export class WaitingDocumentHandler implements ConversationStateHandler {
  readonly state = CONVERSATION_STATES.WAITING_DOCUMENT;

  constructor(
    private readonly inputNormalizer: PatientIdentityInputNormalizerService,
  ) { }

  async handle(
    session: ConversationSession,
    event: NormalizedWhatsappEvent,
  ): Promise<ConversationStateHandlerResult> {
    if (event.kind !== 'incoming_message_received') {
      return {
        nextState: CONVERSATION_STATES.WAITING_DOCUMENT,
        outboundMessages: [],
      };
    }

    const rawDocument = event.textBody ?? '';
    const documentNumber =
      this.inputNormalizer.sanitizeDocumentNumber(rawDocument);

    if (!documentNumber) {
      const attempts =
        (session.context?.patientValidation?.failedAttempts ?? 0) + 1;
      return {
        nextState: CONVERSATION_STATES.WAITING_DOCUMENT,
        nextContext: {
          ...session.context,
          patientValidation: {
            ...session.context?.patientValidation,
            failedAttempts: attempts,
          },
        },
        outboundMessages: [
          {
            type: 'text',
            body: 'No pudimos validar el formato del documento. Escribe solo numeros.',
          },
        ],
      };
    }

    return {
      nextState: CONVERSATION_STATES.WAITING_BIRTH_DATE,
      nextContext: {
        ...session.context,
        patientValidation: {
          failedAttempts:
            session.context?.patientValidation?.failedAttempts ?? 0,
          documentNumber,
          documentNumberMasked:
            this.inputNormalizer.maskDocumentNumber(documentNumber),
        },
      },
      outboundMessages: [
        {
          type: 'text',
          body: 'Ahora escribe tu fecha de nacimiento en formato 23-02-1998 o 23/02/1998.',
        },
      ],
    };
  }
}
