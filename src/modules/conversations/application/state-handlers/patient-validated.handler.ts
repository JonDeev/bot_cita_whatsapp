import { Injectable } from '@nestjs/common';
import { ListFutureAssignedAppointmentsByPatientUseCase } from '../../../appointments/application/use-cases/list-future-assigned-appointments-by-patient.use-case';
import { AuditService } from '../../../audit/application/services/audit.service';
import { ResolveAssignedDispensaryByPatientUseCase } from '../../../patients/application/use-cases/resolve-assigned-dispensary-by-patient.use-case';
import { ResolveEligibleSpecialtiesByPatientUseCase } from '../../../patients/application/use-cases/resolve-eligible-specialties-by-patient.use-case';
import { ResolvePatientContactProfileUseCase } from '../../../patients/application/use-cases/resolve-patient-contact-profile.use-case';
import type { NormalizedWhatsappEvent } from '../../../whatsapp/domain/events/normalized-whatsapp.event';
import { CONVERSATION_STATES } from '../../domain/conversation-state';
import type { ConversationSession } from '../../domain/entities/conversation-session.entity';
import { AssignedDispensaryMessageFactory } from '../services/assigned-dispensary-message.factory';
import { AssignedAppointmentListFactory } from '../services/assigned-appointment-list.factory';
import { NAVIGATION_OPTION_IDS } from '../services/conversation-navigation.service';
import { PatientContactConfirmationMessageFactory } from '../services/patient-contact-confirmation-message.factory';
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
    private readonly resolveAssignedDispensaryByPatient: ResolveAssignedDispensaryByPatientUseCase,
    private readonly resolveEligibleSpecialtiesByPatient: ResolveEligibleSpecialtiesByPatientUseCase,
    private readonly resolvePatientContactProfile: ResolvePatientContactProfileUseCase,
    private readonly assignedAppointmentListFactory: AssignedAppointmentListFactory,
    private readonly assignedDispensaryMessageFactory: AssignedDispensaryMessageFactory,
    private readonly patientContactConfirmationMessageFactory: PatientContactConfirmationMessageFactory,
    private readonly specialtyListFactory: SpecialtyListFactory,
    private readonly auditService: AuditService,
  ) {}

  async handle(
    session: ConversationSession,
    event: NormalizedWhatsappEvent,
  ): Promise<ConversationStateHandlerResult> {
    void event;

    const contactVerificationGate =
      await this.resolveContactVerificationGate(session);
    if (contactVerificationGate) {
      return contactVerificationGate;
    }

    if (session.context?.flowIntent === 'CHECK_APPOINTMENTS') {
      return this.handleCheckAppointmentsIntent(session);
    }

    if (session.context?.flowIntent === 'CANCEL_OR_RESCHEDULE') {
      return this.handleCancelOrRescheduleIntent(session);
    }

    if (session.context?.flowIntent === 'CHECK_DISPENSARY') {
      return this.handleCheckDispensaryIntent(session);
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

    const specialtyResult =
      await this.resolveEligibleSpecialtiesByPatient.execute({
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
      outboundMessages: [
        this.specialtyListFactory.build(specialtyResult.specialties),
      ],
    };
  }

  private async resolveContactVerificationGate(
    session: ConversationSession,
  ): Promise<ConversationStateHandlerResult | null> {
    const flowIntent = session.context?.flowIntent;
    const contactVerification = session.context?.contactVerification;
    if (contactVerification?.completedForCurrentFlow) {
      return null;
    }

    const patientId = session.context?.patientValidation?.patientId ?? null;
    const contactProfileResult =
      await this.resolvePatientContactProfile.execute({
        patientId,
      });

    if (contactProfileResult.status !== 'FOUND') {
      await this.auditService.record('patient.contact_update.failed', {
        conversationKey: session.conversationKey,
        patientId,
        flowIntent: flowIntent ?? null,
        reason: contactProfileResult.reason,
      });

      return {
        nextState: CONVERSATION_STATES.WAITING_DOCUMENT,
        nextContext: {
          ...session.context,
          patientValidation: {
            failedAttempts: 0,
          },
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
            body: 'No fue posible preparar la confirmacion de contacto. Escribe nuevamente tu numero de documento para continuar.',
          },
        ],
      };
    }

    await this.auditService.record('patient.contact_confirmation.prompted', {
      conversationKey: session.conversationKey,
      patientId: contactProfileResult.patientId,
      flowIntent: flowIntent ?? null,
      requiresPhoneUpdate: !contactProfileResult.isPrimaryPhoneValid,
      requiresEmailUpdate: !contactProfileResult.isPrimaryEmailValid,
    });

    return {
      nextState: CONVERSATION_STATES.CONFIRMING_PATIENT_CONTACT,
      nextContext: {
        ...session.context,
        contactVerification: {
          fullName: contactProfileResult.fullName,
          primaryPhone: contactProfileResult.primaryPhone,
          primaryEmail: contactProfileResult.primaryEmail,
          requiresPhoneUpdate: !contactProfileResult.isPrimaryPhoneValid,
          requiresEmailUpdate: !contactProfileResult.isPrimaryEmailValid,
          selectedUpdateMode: undefined,
          pendingPhone: undefined,
          completedForCurrentFlow: false,
          invalidPhoneAttempts: 0,
          invalidEmailAttempts: 0,
        },
      },
      outboundMessages: [
        this.patientContactConfirmationMessageFactory.build({
          fullName: contactProfileResult.fullName,
          primaryPhone: contactProfileResult.primaryPhone,
          primaryEmail: contactProfileResult.primaryEmail,
        }),
      ],
    };
  }

  private async handleCancelOrRescheduleIntent(
    session: ConversationSession,
  ): Promise<ConversationStateHandlerResult> {
    await this.auditService.record(
      'conversation.cancel_or_reschedule.started',
      {
        conversationKey: session.conversationKey,
        patientId: session.context?.patientValidation?.patientId ?? null,
      },
    );

    await this.auditService.record('appointment.assigned_list.requested', {
      conversationKey: session.conversationKey,
      patientId: session.context?.patientValidation?.patientId ?? null,
      offset: 0,
    });

    const listResult =
      await this.listFutureAssignedAppointmentsByPatient.execute({
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
            {
              mode: 'CANCEL_OR_RESCHEDULE',
            },
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

  private async handleCheckAppointmentsIntent(
    session: ConversationSession,
  ): Promise<ConversationStateHandlerResult> {
    await this.auditService.record('conversation.check_appointments.started', {
      conversationKey: session.conversationKey,
      patientId: session.context?.patientValidation?.patientId ?? null,
    });

    await this.auditService.record('appointment.check_list.requested', {
      conversationKey: session.conversationKey,
      patientId: session.context?.patientValidation?.patientId ?? null,
      offset: 0,
    });

    const listResult =
      await this.listFutureAssignedAppointmentsByPatient.execute({
        patientId: session.context?.patientValidation?.patientId ?? null,
        offset: 0,
      });

    if (listResult.status === 'FOUND') {
      await this.auditService.record('appointment.check_list.resolved', {
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
            {
              mode: 'CHECK_APPOINTMENTS',
              patientFullName: listResult.patientFullName,
            },
          ),
        ],
      };
    }

    if (listResult.status === 'EMPTY') {
      await this.auditService.record('appointment.check_list.empty', {
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
            type: 'interactive_buttons',
            body: `Hola ${listResult.patientFullName} No tienes citas agendadas`,
            buttons: [
              {
                id: NAVIGATION_OPTION_IDS.MAIN_MENU,
                title: 'Menu principal',
              },
              {
                id: NAVIGATION_OPTION_IDS.FINISH,
                title: 'Finalizar',
              },
            ],
          },
        ],
      };
    }

    await this.auditService.record('appointment.check_list.failed', {
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
          body: 'En este momento no podemos consultar tus citas agendadas. Intenta nuevamente en unos minutos desde el menu principal.',
        },
      ],
    };
  }

  private async handleCheckDispensaryIntent(
    session: ConversationSession,
  ): Promise<ConversationStateHandlerResult> {
    const patientId = session.context?.patientValidation?.patientId ?? null;
    await this.auditService.record('conversation.check_dispensary.started', {
      conversationKey: session.conversationKey,
      patientId,
    });

    const dispensaryResult =
      await this.resolveAssignedDispensaryByPatient.execute({
        patientId,
      });

    if (dispensaryResult.status === 'FOUND') {
      await this.auditService.record('patient.dispensary.resolved', {
        conversationKey: session.conversationKey,
        patientId,
        dispensaryId: dispensaryResult.dispensary.id,
      });

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
          this.assignedDispensaryMessageFactory.buildAssigned({
            patientFullName: dispensaryResult.patientFullName,
            dispensaryName: dispensaryResult.dispensary.name,
            dispensaryAddress: dispensaryResult.dispensary.address,
            dispensaryCity: dispensaryResult.dispensary.city,
            dispensarySchedule: dispensaryResult.dispensary.schedule,
          }),
        ],
      };
    }

    if (dispensaryResult.status === 'NOT_ASSIGNED') {
      await this.auditService.record('patient.dispensary.not_assigned', {
        conversationKey: session.conversationKey,
        patientId,
      });

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
          this.assignedDispensaryMessageFactory.buildNotAssigned(
            dispensaryResult.patientFullName,
          ),
        ],
      };
    }

    await this.auditService.record('patient.dispensary.failed', {
      conversationKey: session.conversationKey,
      patientId,
      reason: dispensaryResult.reason,
    });

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
        this.assignedDispensaryMessageFactory.buildTechnicalFailure(),
      ],
    };
  }
}
