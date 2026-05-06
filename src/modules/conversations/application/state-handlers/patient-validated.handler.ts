import { Injectable } from '@nestjs/common';
import { AuditService } from '../../../audit/application/services/audit.service';
import { ResolveEligibleSpecialtiesByPatientUseCase } from '../../../patients/application/use-cases/resolve-eligible-specialties-by-patient.use-case';
import type { NormalizedWhatsappEvent } from '../../../whatsapp/domain/events/normalized-whatsapp.event';
import { CONVERSATION_STATES } from '../../domain/conversation-state';
import type { ConversationSession } from '../../domain/entities/conversation-session.entity';
import { SpecialtyListFactory } from '../services/specialty-list.factory';
import type {
  ConversationStateHandler,
  ConversationStateHandlerResult,
} from './conversation-state-handler';

@Injectable()
export class PatientValidatedHandler implements ConversationStateHandler {
  readonly state = CONVERSATION_STATES.PATIENT_VALIDATED;

  constructor(
    private readonly resolveEligibleSpecialtiesByPatient: ResolveEligibleSpecialtiesByPatientUseCase,
    private readonly specialtyListFactory: SpecialtyListFactory,
    private readonly auditService: AuditService,
  ) {}

  async handle(
    session: ConversationSession,
    _event: NormalizedWhatsappEvent,
  ): Promise<ConversationStateHandlerResult> {
    const patientValidationContext = session.context?.patientValidation;
    const epsCode = patientValidationContext?.epsCode;
    const userType = patientValidationContext?.userType;
    const sex = patientValidationContext?.sex;

    if (!epsCode || !userType || !sex) {
      await this.auditService.record('specialty.eligibility.failed', {
        conversationKey: session.conversationKey,
        reason: 'INVALID_PATIENT_PROFILE',
      });
      return {
        nextState: CONVERSATION_STATES.WAITING_DOCUMENT,
        outboundMessages: [
          {
            type: 'text',
            body: 'No fue posible preparar las especialidades. Escribe nuevamente tu numero de documento para continuar.',
          },
        ],
      };
    }

    const specialtyResult = await this.resolveEligibleSpecialtiesByPatient.execute({
      epsCode,
      userType,
      sex,
    });

    if (!specialtyResult.isEligible) {
      await this.auditService.record('specialty.eligibility.empty', {
        conversationKey: session.conversationKey,
        epsCode,
        userType,
        sex,
        reason: specialtyResult.reason,
      });
      return {
        nextState: CONVERSATION_STATES.MAIN_MENU,
        nextContext: {
          ...session.context,
          specialtySelection: undefined,
          appointmentDoctorSelection: undefined,
        },
        outboundMessages: [
          {
            type: 'text',
            body: 'En este momento no hay especialidades disponibles para tu perfil. Te recomendamos continuar con un asesor humano.',
          },
        ],
      };
    }

    await this.auditService.record('specialty.eligibility.resolved', {
      conversationKey: session.conversationKey,
      epsCode,
      userType,
      sex,
      availableSpecialtyCount: specialtyResult.specialties.length,
    });

    return {
      nextState: CONVERSATION_STATES.SELECTING_SPECIALTY,
      nextContext: {
        ...session.context,
        specialtySelection: {
          offeredSpecialties: specialtyResult.specialties.map((specialty) => ({
            code: specialty.code,
            name: specialty.name,
            cups: specialty.cups ?? undefined,
          })),
        },
        appointmentDoctorSelection: undefined,
        appointmentDateSelection: undefined,
        appointmentTimeSelection: undefined,
      },
      outboundMessages: [this.specialtyListFactory.build(specialtyResult.specialties)],
    };
  }
}
