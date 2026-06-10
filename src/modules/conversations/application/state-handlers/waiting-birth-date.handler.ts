import { Injectable } from '@nestjs/common';
import { AuditService } from '../../../audit/application/services/audit.service';
import { PatientIdentityInputNormalizerService } from '../../../patients/application/services/patient-identity-input-normalizer.service';
import { ValidatePatientByDocumentAndBirthDateUseCase } from '../../../patients/application/use-cases/validate-patient-by-document-and-birth-date.use-case';
import type { NormalizedWhatsappEvent } from '../../../whatsapp/domain/events/normalized-whatsapp.event';
import { CONVERSATION_STATES } from '../../domain/conversation-state';
import type { ConversationSession } from '../../domain/entities/conversation-session.entity';
import type {
  ConversationStateHandler,
  ConversationStateHandlerResult,
} from './conversation-state-handler';

@Injectable()
export class WaitingBirthDateHandler implements ConversationStateHandler {
  readonly state = CONVERSATION_STATES.WAITING_BIRTH_DATE;

  constructor(
    private readonly inputNormalizer: PatientIdentityInputNormalizerService,
    private readonly validatePatient: ValidatePatientByDocumentAndBirthDateUseCase,
    private readonly auditService: AuditService,
  ) { }

  async handle(
    session: ConversationSession,
    event: NormalizedWhatsappEvent,
  ): Promise<ConversationStateHandlerResult> {
    if (event.kind !== 'incoming_message_received') {
      return {
        nextState: CONVERSATION_STATES.WAITING_BIRTH_DATE,
        outboundMessages: [],
      };
    }

    const maxAttempts = 3;
    const currentAttempts =
      session.context?.patientValidation?.failedAttempts ?? 0;
    const documentNumber = session.context?.patientValidation?.documentNumber;
    const documentMasked =
      session.context?.patientValidation?.documentNumberMasked;

    if (!documentNumber) {
      return {
        nextState: CONVERSATION_STATES.WAITING_DOCUMENT,
        outboundMessages: [
          {
            type: 'text',
            body: 'Necesitamos tu documento para continuar. Escribe tu numero de documento.',
          },
        ],
      };
    }

    const parsedBirthDate = this.inputNormalizer.parseWhatsappBirthDate(
      event.textBody ?? '',
    );
    if (!parsedBirthDate) {
      const attempts = currentAttempts + 1;
      if (attempts >= maxAttempts) {
        return {
          nextState: CONVERSATION_STATES.MAIN_MENU,
          nextContext: {
            ...session.context,
            patientValidation: {
              failedAttempts: attempts,
            },
          },
          outboundMessages: [
            {
              type: 'text',
              body: 'No fue posible validar tus datos. Te recomendamos solicitar apoyo de un asesor humano.',
            },
          ],
        };
      }

      return {
        nextState: CONVERSATION_STATES.WAITING_BIRTH_DATE,
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
            body: 'La fecha no tiene el formato esperado. Escribe tu fecha de nacimiento en 23-02-1998 o 23/02/1998.',
          },
        ],
      };
    }

    const validationResult = await this.validatePatient.execute({
      documentNumber,
      birthDateIso: parsedBirthDate.isoDate,
    });

    if (!validationResult.isValid) {
      const attempts = currentAttempts + 1;
      await this.auditService.record('patient.validation.failed', {
        conversationKey: session.conversationKey,
        documentMasked: documentMasked ?? '***',
        reason: validationResult.reason,
        attempts,
      });

      if (attempts >= maxAttempts) {
        return {
          nextState: CONVERSATION_STATES.MAIN_MENU,
          nextContext: {
            ...session.context,
            patientValidation: {
              failedAttempts: attempts,
            },
          },
          outboundMessages: [
            {
              type: 'text',
              body: 'No fue posible validar tu identidad. Te recomendamos continuar con un asesor humano.',
            },
          ],
        };
      }

      return {
        nextState: CONVERSATION_STATES.WAITING_DOCUMENT,
        nextContext: {
          ...session.context,
          patientValidation: {
            failedAttempts: attempts,
          },
        },
        outboundMessages: [
          {
            type: 'text',
            body: 'No pudimos validar tus datos. Intenta nuevamente con tu numero de documento.',
          },
        ],
      };
    }

    await this.auditService.record('patient.validation.succeeded', {
      conversationKey: session.conversationKey,
      documentMasked: documentMasked ?? '***',
      patientId: validationResult.patientId,
      epsCode: validationResult.epsCode,
      userType: validationResult.userType,
      sex: validationResult.sex,
    });

    return {
      nextState: CONVERSATION_STATES.PATIENT_VALIDATED,
      nextContext: {
        ...session.context,
        patientValidation: {
          failedAttempts: 0,
          documentNumber,
          documentNumberMasked: documentMasked,
          patientId: validationResult.patientId,
          epsCode: validationResult.epsCode,
          userType: validationResult.userType,
          sex: validationResult.sex,
        },
        contactVerification: undefined,
        specialtySelection: undefined,
        appointmentDoctorSelection: undefined,
        appointmentDateSelection: undefined,
        appointmentTimeSelection: undefined,
      },
      outboundMessages: [],
    };
  }
}
