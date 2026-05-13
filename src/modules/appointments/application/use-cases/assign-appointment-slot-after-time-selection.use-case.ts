import { Inject, Injectable } from '@nestjs/common';
import {
  APPOINTMENT_ASSIGNMENT_REPOSITORY,
  APPOINTMENT_CONFIRMATION_DETAILS_REPOSITORY,
} from '../../domain/appointments.tokens';
import type { AppointmentAssignmentRepository } from '../../domain/ports/appointment-assignment.repository';
import type {
  AppointmentConfirmationDetailsRepository,
  PatientAppointmentConfirmationDetails,
} from '../../domain/ports/appointment-confirmation-details.repository';
import { AppointmentTimePresenterService } from '../services/appointment-time-presenter.service';

export interface AssignAppointmentSlotAfterTimeSelectionInput {
  patientId?: number | null;
  specialtyName?: string | null;
  specialtyCups?: string | null;
  appointmentDateIso?: string | null;
  appointmentTimeHHmm?: string | null;
  preferredSlotRef?: string | null;
  doctorEmployeeCode?: string | null;
  now?: Date;
}

export interface AssignedAppointmentDetails {
  slotRef: string;
  specialtyName: string;
  patientFullName: string;
  appointmentDateIso: string;
  appointmentTimeHHmm: string;
  appointmentDisplayTime: string;
  professionalName: string;
  siteName: string;
  siteAddress: string;
  usedFallbackSlot: boolean;
}

export type AssignAppointmentSlotAfterTimeSelectionResult =
  | {
      status: 'ASSIGNED';
      appointment: AssignedAppointmentDetails;
    }
  | {
      status: 'TIME_NO_LONGER_AVAILABLE';
    }
  | {
      status: 'TECHNICAL_FAILURE';
      reason:
        | 'INVALID_INPUT'
        | 'PATIENT_NOT_FOUND'
        | 'ASSIGNED_SLOT_NOT_FOUND'
        | 'UNEXPECTED_ERROR';
    };

@Injectable()
export class AssignAppointmentSlotAfterTimeSelectionUseCase {
  private static readonly BOT_ENABLED_SITE_ID = 109;
  private static readonly ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
  private static readonly TIME_HHMM_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;
  private static readonly TIMEZONE = 'America/Bogota';
  private static readonly DEFAULT_PATIENT_PHONE = '0000';
  private static readonly DEFAULT_PROFESSIONAL_NAME =
    'PROFESIONAL POR CONFIRMAR';
  private static readonly DEFAULT_SITE_NAME = 'Santa Marta';
  private static readonly DEFAULT_SITE_ADDRESS = 'Direccion por confirmar';

  constructor(
    @Inject(APPOINTMENT_ASSIGNMENT_REPOSITORY)
    private readonly appointmentAssignmentRepository: AppointmentAssignmentRepository,
    @Inject(APPOINTMENT_CONFIRMATION_DETAILS_REPOSITORY)
    private readonly appointmentConfirmationDetailsRepository: AppointmentConfirmationDetailsRepository,
    private readonly appointmentTimePresenterService: AppointmentTimePresenterService,
  ) {}

  async execute(
    input: AssignAppointmentSlotAfterTimeSelectionInput,
  ): Promise<AssignAppointmentSlotAfterTimeSelectionResult> {
    const normalizedInput = this.normalizeInput(input);
    if (!normalizedInput) {
      return {
        status: 'TECHNICAL_FAILURE',
        reason: 'INVALID_INPUT',
      };
    }

    try {
      const patientDetails =
        await this.appointmentConfirmationDetailsRepository.findPatientById(
          normalizedInput.patientId,
        );
      if (!patientDetails) {
        return {
          status: 'TECHNICAL_FAILURE',
          reason: 'PATIENT_NOT_FOUND',
        };
      }

      const assignmentContext = {
        patientUserId: String(patientDetails.userId),
        patientPhone: this.normalizePhone(patientDetails.phone),
        requestDateIso: this.formatDateIsoInBogota(input.now ?? new Date()),
        requiredSiteId:
          AssignAppointmentSlotAfterTimeSelectionUseCase.BOT_ENABLED_SITE_ID,
      };

      const wasPrimaryAssigned =
        await this.appointmentAssignmentRepository.assignSlotIfAvailable({
          slotRef: normalizedInput.preferredSlotRef,
          ...assignmentContext,
        });

      if (wasPrimaryAssigned) {
        return this.buildAssignedResult(
          normalizedInput.preferredSlotRef,
          false,
          normalizedInput.specialtyName,
          patientDetails,
        );
      }

      if (normalizedInput.doctorEmployeeCode) {
        return { status: 'TIME_NO_LONGER_AVAILABLE' };
      }

      const fallbackSlot =
        await this.appointmentAssignmentRepository.findFallbackAvailableSlot({
          specialtyCups: normalizedInput.specialtyCups,
          appointmentDateIso: normalizedInput.appointmentDateIso,
          appointmentTimeHHmm: normalizedInput.appointmentTimeHHmm,
          requiredSiteId:
            AssignAppointmentSlotAfterTimeSelectionUseCase.BOT_ENABLED_SITE_ID,
          excludeSlotRef: normalizedInput.preferredSlotRef,
        });
      if (!fallbackSlot) {
        return { status: 'TIME_NO_LONGER_AVAILABLE' };
      }

      const wasFallbackAssigned =
        await this.appointmentAssignmentRepository.assignSlotIfAvailable({
          slotRef: fallbackSlot.slotRef,
          ...assignmentContext,
        });
      if (!wasFallbackAssigned) {
        return { status: 'TIME_NO_LONGER_AVAILABLE' };
      }

      return this.buildAssignedResult(
        fallbackSlot.slotRef,
        true,
        normalizedInput.specialtyName,
        patientDetails,
      );
    } catch {
      return {
        status: 'TECHNICAL_FAILURE',
        reason: 'UNEXPECTED_ERROR',
      };
    }
  }

  private async buildAssignedResult(
    slotRef: string,
    usedFallbackSlot: boolean,
    specialtyName: string,
    patientDetails: PatientAppointmentConfirmationDetails,
  ): Promise<AssignAppointmentSlotAfterTimeSelectionResult> {
    const assignedAppointment =
      await this.appointmentConfirmationDetailsRepository.findAssignedAppointmentBySlotRef(
        slotRef,
      );

    if (!assignedAppointment) {
      return {
        status: 'TECHNICAL_FAILURE',
        reason: 'ASSIGNED_SLOT_NOT_FOUND',
      };
    }

    return {
      status: 'ASSIGNED',
      appointment: {
        slotRef: assignedAppointment.slotRef,
        specialtyName,
        patientFullName: this.buildPatientFullName(patientDetails),
        appointmentDateIso: assignedAppointment.appointmentDateIso,
        appointmentTimeHHmm: assignedAppointment.appointmentTimeHHmm,
        appointmentDisplayTime:
          this.appointmentTimePresenterService.formatHHmmAsTwelveHour(
            assignedAppointment.appointmentTimeHHmm,
          ),
        professionalName:
          assignedAppointment.professionalName?.trim() ||
          AssignAppointmentSlotAfterTimeSelectionUseCase.DEFAULT_PROFESSIONAL_NAME,
        siteName:
          assignedAppointment.siteName?.trim() ||
          AssignAppointmentSlotAfterTimeSelectionUseCase.DEFAULT_SITE_NAME,
        siteAddress:
          assignedAppointment.siteAddress?.trim() ||
          AssignAppointmentSlotAfterTimeSelectionUseCase.DEFAULT_SITE_ADDRESS,
        usedFallbackSlot,
      },
    };
  }

  private normalizeInput(input: AssignAppointmentSlotAfterTimeSelectionInput): {
    patientId: number;
    specialtyName: string;
    specialtyCups: string;
    appointmentDateIso: string;
    appointmentTimeHHmm: string;
    preferredSlotRef: string;
    doctorEmployeeCode?: string;
  } | null {
    const patientId = input.patientId ?? null;
    const specialtyName = input.specialtyName?.trim() ?? '';
    const specialtyCups = input.specialtyCups?.trim() ?? '';
    const appointmentDateIso = input.appointmentDateIso?.trim() ?? '';
    const appointmentTimeHHmm = input.appointmentTimeHHmm?.trim() ?? '';
    const preferredSlotRef = input.preferredSlotRef?.trim() ?? '';
    const doctorEmployeeCode = input.doctorEmployeeCode?.trim() || undefined;

    if (
      typeof patientId !== 'number' ||
      !Number.isInteger(patientId) ||
      patientId <= 0 ||
      !specialtyName ||
      !specialtyCups ||
      !preferredSlotRef ||
      !AssignAppointmentSlotAfterTimeSelectionUseCase.ISO_DATE_PATTERN.test(
        appointmentDateIso,
      ) ||
      !AssignAppointmentSlotAfterTimeSelectionUseCase.TIME_HHMM_PATTERN.test(
        appointmentTimeHHmm,
      )
    ) {
      return null;
    }

    return {
      patientId,
      specialtyName,
      specialtyCups,
      appointmentDateIso,
      appointmentTimeHHmm,
      preferredSlotRef,
      doctorEmployeeCode,
    };
  }

  private formatDateIsoInBogota(now: Date): string {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: AssignAppointmentSlotAfterTimeSelectionUseCase.TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });

    return formatter.format(now);
  }

  private normalizePhone(phone: string | null): string {
    const normalizedPhone = phone?.trim() ?? '';
    return (
      normalizedPhone ||
      AssignAppointmentSlotAfterTimeSelectionUseCase.DEFAULT_PATIENT_PHONE
    );
  }

  private buildPatientFullName(
    patientDetails: PatientAppointmentConfirmationDetails,
  ): string {
    const fullName = [
      patientDetails.firstName,
      patientDetails.secondName,
      patientDetails.firstLastName,
      patientDetails.secondLastName,
    ]
      .map((part) => part?.trim() ?? '')
      .filter((part) => part.length > 0)
      .join(' ')
      .trim();

    return fullName || 'PACIENTE';
  }
}
