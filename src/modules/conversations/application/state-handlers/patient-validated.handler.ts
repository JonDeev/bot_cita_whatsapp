import { Injectable } from '@nestjs/common';
import { ListFutureAssignedAppointmentsByPatientUseCase } from '../../../appointments/application/use-cases/list-future-assigned-appointments-by-patient.use-case';
import { AuditService } from '../../../audit/application/services/audit.service';
import { ResolveEligibleSpecialtiesByPatientUseCase } from '../../../patients/application/use-cases/resolve-eligible-specialties-by-patient.use-case';
import type { NormalizedWhatsappEvent } from '../../../whatsapp/domain/events/normalized-whatsapp.event';
import { CONVERSATION_STATES } from '../../domain/conversation-state';
import type { ConversationSession } from '../../domain/entities/conversation-session.entity';
import { AssignedAppointmentListFactory } from '../services/assigned-appointment-list.factory';
import { SpecialtyListFactory } from '../services/specialty-list.factory';
import type {
  ConversationStateHandler,
  ConversationStateHandlerResult,
} from './conversation-state-handler';

@Injectable()
export class PatientValidatedHandler implements ConversationStateHandler {
  readonly state = CONVERSATION_STATES.PATIENT_VALIDATED;

  constructor(
    private readonly listFutureAssignedAppointmentsByPatient: ListFutureAssignedAppointmentsByPatientUseCase,
    private readonly resolveEligibleSpecialtiesByPatient: ResolveEligibleSpecialtiesByPatientUseCase,
    private readonly assignedAppointmentListFactory: AssignedAppointmentListFactory,
    private readonly specialtyListFactory: SpecialtyListFactory,
    private readonly auditService: AuditService,
  ) {}

  async handle(
    session: ConversationSession,
    _event: NormalizedWhatsappEvent,
  ): Promise<ConversationStateHandlerResult> {
    if (session.context?.flowIntent === 'CANCEL_OR_RESCHEDULE') {
      return this.handleCancelOrRescheduleIntent(session);
    }

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
          appointmentReschedule: undefined,
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
        appointmentReschedule: undefined,
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

  private async handleCancelOrRescheduleIntent(
    session: ConversationSession,
  ): Promise<ConversationStateHandlerResult> {
    await this.auditService.record('conversation.cancel_or_reschedule.started', {
      conversationKey: session.conversationKey,
      patientId: session.context?.patientValidation?.patientId ?? null,
    });

    await this.auditService.record('appointment.assigned_list.requested', {
      conversationKey: session.conversationKey,
      patientId: session.context?.patientValidation?.patientId ?? null,
      offset: 0,
    });

    const listResult = await this.listFutureAssignedAppointmentsByPatient.execute({
      patientId: session.context?.patientValidation?.patientId ?? null,
      offset: 0,
    });

    if (listResult.status === 'FOUND') {
      await this.auditService.record('appointment.assigned_list.resolved', {
        conversationKey: session.conversationKey,
        patientId: session.context?.patientValidation?.patientId ?? null,
        appointmentCount: listResult.appointments.length,
        hasMore: listResult.hasMore,
        offset: listResult.currentOffset,
      });

      return {
        nextState: CONVERSATION_STATES.SELECTING_ASSIGNED_APPOINTMENT,
        nextContext: {
          ...session.context,
          appointmentReschedule: undefined,
          assignedAppointmentSelection: {
            patientFullName: listResult.patientFullName,
            currentOffset: listResult.currentOffset,
            hasMoreAppointments: listResult.hasMore,
            nextOffset: listResult.nextOffset,
            offeredAppointments: listResult.appointments,
            selectedAppointment: undefined,
          },
        },
        outboundMessages: [
          this.assignedAppointmentListFactory.build(
            listResult.appointments,
            listResult.hasMore,
          ),
        ],
      };
    }

    if (listResult.status === 'EMPTY') {
      await this.auditService.record('appointment.assigned_list.empty', {
        conversationKey: session.conversationKey,
        patientId: session.context?.patientValidation?.patientId ?? null,
      });

      return {
        nextState: CONVERSATION_STATES.SELECTING_ASSIGNED_APPOINTMENT,
        nextContext: {
          ...session.context,
          appointmentReschedule: undefined,
          assignedAppointmentSelection: {
            patientFullName: listResult.patientFullName,
            currentOffset: 0,
            hasMoreAppointments: false,
            offeredAppointments: [],
            selectedAppointment: undefined,
          },
        },
        outboundMessages: [
          {
            type: 'text',
            body: `Hola ${listResult.patientFullName} Usted no tiene citas agendadas`,
          },
        ],
      };
    }

    await this.auditService.record('appointment.assigned_list.failed', {
      conversationKey: session.conversationKey,
      patientId: session.context?.patientValidation?.patientId ?? null,
      reason: listResult.reason,
    });

    return {
      nextState: CONVERSATION_STATES.SELECTING_ASSIGNED_APPOINTMENT,
      nextContext: {
        ...session.context,
        appointmentReschedule: undefined,
        assignedAppointmentSelection: undefined,
      },
      outboundMessages: [
        {
          type: 'text',
          body: 'En este momento no podemos consultar tus citas asignadas. Intenta nuevamente en unos minutos desde el menu principal.',
        },
      ],
    };
  }
}
