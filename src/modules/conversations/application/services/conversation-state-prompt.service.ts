import { Injectable } from '@nestjs/common';
import {
  CONVERSATION_STATES,
  type ConversationState,
} from '../../domain/conversation-state';
import type { ConversationSessionContext } from '../../domain/entities/conversation-session-context.entity';
import type { ConversationSession } from '../../domain/entities/conversation-session.entity';
import type { ConversationOutboundMessage } from '../../domain/value-objects/conversation-outbound-message';
import { AssignedAppointmentConsultationDetailsMessageFactory } from './assigned-appointment-consultation-details-message.factory';
import { AssignedAppointmentDetailsMessageFactory } from './assigned-appointment-details-message.factory';
import { AssignedAppointmentListFactory } from './assigned-appointment-list.factory';
import { AppointmentDoctorListFactory } from './appointment-doctor-list.factory';
import { AppointmentDateListFactory } from './appointment-date-list.factory';
import { AppointmentNotificationOptInMessageFactory } from './appointment-notification-opt-in-message.factory';
import { AppointmentTimeListFactory } from './appointment-time-list.factory';
import { MainMenuListFactory } from './main-menu-list.factory';
import { PatientContactConfirmationMessageFactory } from './patient-contact-confirmation-message.factory';
import { PatientContactUpdateOptionsListFactory } from './patient-contact-update-options-list.factory';
import { SpecialtyListFactory } from './specialty-list.factory';

export interface ConversationStatePromptResult {
  nextState: ConversationState;
  nextContext?: ConversationSessionContext;
  outboundMessages: ConversationOutboundMessage[];
}

@Injectable()
export class ConversationStatePromptService {
  constructor(
    private readonly mainMenuListFactory: MainMenuListFactory,
    private readonly specialtyListFactory: SpecialtyListFactory,
    private readonly assignedAppointmentListFactory: AssignedAppointmentListFactory,
    private readonly assignedAppointmentConsultationDetailsMessageFactory: AssignedAppointmentConsultationDetailsMessageFactory,
    private readonly assignedAppointmentDetailsMessageFactory: AssignedAppointmentDetailsMessageFactory,
    private readonly appointmentDoctorListFactory: AppointmentDoctorListFactory,
    private readonly appointmentDateListFactory: AppointmentDateListFactory,
    private readonly appointmentTimeListFactory: AppointmentTimeListFactory,
    private readonly appointmentNotificationOptInMessageFactory: AppointmentNotificationOptInMessageFactory,
    private readonly patientContactConfirmationMessageFactory: PatientContactConfirmationMessageFactory,
    private readonly patientContactUpdateOptionsListFactory: PatientContactUpdateOptionsListFactory,
  ) { }

  buildForState(
    session: ConversationSession,
    state: ConversationState,
  ): ConversationStatePromptResult {
    switch (state) {
      case CONVERSATION_STATES.MAIN_MENU:
        return {
          nextState: CONVERSATION_STATES.MAIN_MENU,
          outboundMessages: [this.mainMenuListFactory.build()],
        };

      case CONVERSATION_STATES.WAITING_DOCUMENT:
        return {
          nextState: CONVERSATION_STATES.WAITING_DOCUMENT,
          outboundMessages: [
            {
              type: 'text',
              body: 'Escribe tu numero de documento de identidad.',
            },
          ],
        };

      case CONVERSATION_STATES.WAITING_BIRTH_DATE:
        if (!session.context?.patientValidation?.documentNumber) {
          return this.buildForState(
            session,
            CONVERSATION_STATES.WAITING_DOCUMENT,
          );
        }

        return {
          nextState: CONVERSATION_STATES.WAITING_BIRTH_DATE,
          outboundMessages: [
            {
              type: 'text',
              body: 'Ahora escribe tu fecha de nacimiento en formato 23-02-1998 o 23/02/1998.',
            },
          ],
        };

      case CONVERSATION_STATES.CONFIRMING_PATIENT_CONTACT: {
        const contactVerification = session.context?.contactVerification;
        if (!contactVerification) {
          return this.buildForState(
            session,
            CONVERSATION_STATES.WAITING_DOCUMENT,
          );
        }

        return {
          nextState: CONVERSATION_STATES.CONFIRMING_PATIENT_CONTACT,
          outboundMessages: [
            this.patientContactConfirmationMessageFactory.build({
              fullName: contactVerification.fullName,
              primaryPhone: contactVerification.primaryPhone,
              primaryEmail: contactVerification.primaryEmail,
            }),
          ],
        };
      }

      case CONVERSATION_STATES.SELECTING_CONTACT_UPDATE_FIELD:
        return {
          nextState: CONVERSATION_STATES.SELECTING_CONTACT_UPDATE_FIELD,
          outboundMessages: [
            this.patientContactUpdateOptionsListFactory.build(),
          ],
        };

      case CONVERSATION_STATES.UPDATING_CONTACT_PHONE:
        return {
          nextState: CONVERSATION_STATES.UPDATING_CONTACT_PHONE,
          outboundMessages: [
            {
              type: 'text',
              body: 'Escribe tu nuevo numero celular en formato 3001234567.',
            },
          ],
        };

      case CONVERSATION_STATES.UPDATING_CONTACT_EMAIL:
        return {
          nextState: CONVERSATION_STATES.UPDATING_CONTACT_EMAIL,
          outboundMessages: [
            {
              type: 'text',
              body: 'Escribe tu nuevo correo electronico.',
            },
          ],
        };

      case CONVERSATION_STATES.SELECTING_ASSIGNED_APPOINTMENT: {
        const assignedSelection = session.context?.assignedAppointmentSelection;
        const offeredAppointments =
          assignedSelection?.offeredAppointments ?? [];
        if (offeredAppointments.length === 0) {
          return this.buildMainMenuFallback(
            'No encontramos citas asignadas para continuar. Volvamos al menu principal.',
          );
        }

        return {
          nextState: CONVERSATION_STATES.SELECTING_ASSIGNED_APPOINTMENT,
          outboundMessages: [
            this.assignedAppointmentListFactory.build(
              offeredAppointments,
              assignedSelection?.hasMoreAppointments ?? false,
              {
                mode:
                  session.context?.flowIntent === 'CHECK_APPOINTMENTS'
                    ? 'CHECK_APPOINTMENTS'
                    : 'CANCEL_OR_RESCHEDULE',
                patientFullName: assignedSelection?.patientFullName,
              },
            ),
          ],
        };
      }

      case CONVERSATION_STATES.REVIEWING_ASSIGNED_APPOINTMENT_DETAILS: {
        const assignedSelection = session.context?.assignedAppointmentSelection;
        const selectedAppointment = assignedSelection?.selectedAppointment;
        if (!selectedAppointment) {
          return this.buildForState(
            session,
            CONVERSATION_STATES.SELECTING_ASSIGNED_APPOINTMENT,
          );
        }

        return {
          nextState: CONVERSATION_STATES.REVIEWING_ASSIGNED_APPOINTMENT_DETAILS,
          outboundMessages: [
            this.assignedAppointmentConsultationDetailsMessageFactory.build({
              patientFullName: assignedSelection?.patientFullName ?? 'PACIENTE',
              specialtyName: selectedAppointment.specialtyName,
              professionalName: selectedAppointment.professionalName,
              siteName: selectedAppointment.siteName,
              siteAddress: selectedAppointment.siteAddress,
              appointmentDateIso: selectedAppointment.appointmentDateIso,
              appointmentDisplayTime:
                selectedAppointment.appointmentDisplayTime,
            }),
          ],
        };
      }

      case CONVERSATION_STATES.REVIEWING_ASSIGNED_APPOINTMENT_ACTIONS: {
        const assignedSelection = session.context?.assignedAppointmentSelection;
        const selectedAppointment = assignedSelection?.selectedAppointment;
        if (!selectedAppointment) {
          return this.buildForState(
            session,
            CONVERSATION_STATES.SELECTING_ASSIGNED_APPOINTMENT,
          );
        }

        return {
          nextState: CONVERSATION_STATES.REVIEWING_ASSIGNED_APPOINTMENT_ACTIONS,
          outboundMessages: [
            this.assignedAppointmentDetailsMessageFactory.build({
              patientFullName: assignedSelection?.patientFullName ?? 'PACIENTE',
              specialtyName: selectedAppointment.specialtyName,
              professionalName: selectedAppointment.professionalName,
              appointmentDateIso: selectedAppointment.appointmentDateIso,
              appointmentDisplayTime:
                selectedAppointment.appointmentDisplayTime,
            }),
          ],
        };
      }

      case CONVERSATION_STATES.SELECTING_SPECIALTY: {
        const offeredSpecialties =
          session.context?.specialtySelection?.offeredSpecialties ?? [];
        if (offeredSpecialties.length === 0) {
          return this.buildMainMenuFallback(
            'No encontramos especialidades activas para continuar. Volvamos al menu principal.',
          );
        }

        return {
          nextState: CONVERSATION_STATES.SELECTING_SPECIALTY,
          outboundMessages: [
            this.specialtyListFactory.build(offeredSpecialties),
          ],
        };
      }

      case CONVERSATION_STATES.SELECTING_APPOINTMENT_DOCTOR: {
        const offeredDoctors =
          session.context?.appointmentDoctorSelection?.offeredDoctors ?? [];
        if (offeredDoctors.length === 0) {
          return this.buildMainMenuFallback(
            'No encontramos medicos disponibles para continuar. Volvamos al menu principal.',
          );
        }

        return {
          nextState: CONVERSATION_STATES.SELECTING_APPOINTMENT_DOCTOR,
          outboundMessages: [
            this.appointmentDoctorListFactory.build(offeredDoctors),
          ],
        };
      }

      case CONVERSATION_STATES.SELECTING_APPOINTMENT_DATE: {
        const appointmentDateSelection =
          session.context?.appointmentDateSelection;
        const offeredDates = appointmentDateSelection?.offeredDates ?? [];
        if (offeredDates.length === 0) {
          return this.buildMainMenuFallback(
            'No encontramos fechas disponibles para continuar. Volvamos al menu principal.',
          );
        }

        return {
          nextState: CONVERSATION_STATES.SELECTING_APPOINTMENT_DATE,
          outboundMessages: [
            this.appointmentDateListFactory.build(offeredDates, {
              includeChooseDoctor: appointmentDateSelection?.scope !== 'DOCTOR',
            }),
          ],
        };
      }

      case CONVERSATION_STATES.SELECTING_APPOINTMENT_TIME: {
        const offeredTimes =
          session.context?.appointmentTimeSelection?.offeredTimes ?? [];
        const hasMoreTimes =
          session.context?.appointmentTimeSelection?.hasMoreTimes ?? false;
        if (offeredTimes.length === 0) {
          return this.buildMainMenuFallback(
            'No encontramos horas disponibles para continuar. Volvamos al menu principal.',
          );
        }

        return {
          nextState: CONVERSATION_STATES.SELECTING_APPOINTMENT_TIME,
          outboundMessages: [
            this.appointmentTimeListFactory.build(offeredTimes, hasMoreTimes),
          ],
        };
      }

      case CONVERSATION_STATES.REQUESTING_WHATSAPP_APPOINTMENT_NOTIFICATIONS_OPT_IN:
        return {
          nextState:
            CONVERSATION_STATES.REQUESTING_WHATSAPP_APPOINTMENT_NOTIFICATIONS_OPT_IN,
          outboundMessages: [
            this.appointmentNotificationOptInMessageFactory.build(),
          ],
        };

      default:
        return this.buildForState(session, CONVERSATION_STATES.MAIN_MENU);
    }
  }

  private buildMainMenuFallback(
    message: string,
  ): ConversationStatePromptResult {
    return {
      nextState: CONVERSATION_STATES.MAIN_MENU,
      outboundMessages: [
        {
          type: 'text',
          body: message,
        },
        this.mainMenuListFactory.build(),
      ],
    };
  }
}
