import { Inject, Injectable } from '@nestjs/common';
import {
  APPOINTMENT_CONFIRMATION_DETAILS_REPOSITORY,
  APPOINTMENT_RESCHEDULING_REPOSITORY,
} from '../../domain/appointments.tokens';
import type {
  AppointmentConfirmationDetailsRepository,
  PatientAppointmentConfirmationDetails,
} from '../../domain/ports/appointment-confirmation-details.repository';
import type { AppointmentReschedulingRepository } from '../../domain/ports/appointment-rescheduling.repository';
import { AppointmentTimePresenterService } from '../services/appointment-time-presenter.service';
import type { AssignedAppointmentDetails } from './assign-appointment-slot-after-time-selection.use-case';

export interface RescheduleAssignedAppointmentByPatientInput {
  patientId?: number | null;
  originalSlotRef?: string | null;
  specialtyName?: string | null;
  specialtyCups?: string | null;
  appointmentDateIso?: string | null;
  appointmentTimeHHmm?: string | null;
  preferredNewSlotRef?: string | null;
  doctorEmployeeCode?: string | null;
  now?: Date;
}

export type RescheduleAssignedAppointmentByPatientResult =
  | {
      status: 'RESCHEDULED';
      appointment: AssignedAppointmentDetails;
    }
  | {
      status: 'TIME_NO_LONGER_AVAILABLE';
    }
  | {
      status: 'ORIGINAL_APPOINTMENT_NOT_REBOOKABLE';
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
export class RescheduleAssignedAppointmentByPatientUseCase {
  private static readonly BOT_ENABLED_SITE_ID = 109;
  private static readonly ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
  private static readonly TIME_HHMM_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;
  private static readonly TIMEZONE = 'America/Bogota';
  private static readonly DEFAULT_PATIENT_PHONE = '0000';
  private static readonly DEFAULT_PROFESSIONAL_NAME = 'PROFESIONAL POR CONFIRMAR';
  private static readonly DEFAULT_SITE_NAME = 'Santa Marta';
  private static readonly DEFAULT_SITE_ADDRESS = 'Direccion por confirmar';

  constructor(
    @Inject(APPOINTMENT_RESCHEDULING_REPOSITORY)
    private readonly appointmentReschedulingRepository: AppointmentReschedulingRepository,
    @Inject(APPOINTMENT_CONFIRMATION_DETAILS_REPOSITORY)
    private readonly appointmentConfirmationDetailsRepository: AppointmentConfirmationDetailsRepository,
    private readonly appointmentTimePresenterService: AppointmentTimePresenterService,
  ) {}

  async execute(
    input: RescheduleAssignedAppointmentByPatientInput,
  ): Promise<RescheduleAssignedAppointmentByPatientResult> {
    const normalizedInput = this.normalizeInput(input);
    if (!normalizedInput) {
      return {
        status: 'TECHNICAL_FAILURE',
        reason: 'INVALID_INPUT',
      };
    }

    try {
      const patientDetails = await this.appointmentConfirmationDetailsRepository.findPatientById(
        normalizedInput.patientId,
      );
      if (!patientDetails) {
        return {
          status: 'TECHNICAL_FAILURE',
          reason: 'PATIENT_NOT_FOUND',
        };
      }

      const nowParts = this.formatNowInBogota(normalizedInput.now);
      const rescheduleResult =
        await this.appointmentReschedulingRepository.rescheduleAssignedFutureAppointmentByPatient({
          patientUserId: String(patientDetails.userId),
          patientPhone: this.normalizePhone(patientDetails.phone),
          originalSlotRef: normalizedInput.originalSlotRef,
          preferredNewSlotRef: normalizedInput.preferredNewSlotRef,
          specialtyCups: normalizedInput.specialtyCups,
          appointmentDateIso: normalizedInput.appointmentDateIso,
          appointmentTimeHHmm: normalizedInput.appointmentTimeHHmm,
          currentDateIso: nowParts.dateIso,
          currentTimeHHmm: nowParts.timeHHmm,
          requestDateIso: nowParts.dateIso,
          canceledDateIso: nowParts.dateIso,
          requiredSiteId: RescheduleAssignedAppointmentByPatientUseCase.BOT_ENABLED_SITE_ID,
          doctorEmployeeCode: normalizedInput.doctorEmployeeCode,
        });

      if (rescheduleResult.status === 'TIME_NO_LONGER_AVAILABLE') {
        return { status: 'TIME_NO_LONGER_AVAILABLE' };
      }

      if (rescheduleResult.status === 'ORIGINAL_APPOINTMENT_NOT_REBOOKABLE') {
        return { status: 'ORIGINAL_APPOINTMENT_NOT_REBOOKABLE' };
      }

      return this.buildRescheduledResult(
        rescheduleResult.assignedSlotRef,
        rescheduleResult.usedFallbackSlot,
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

  private async buildRescheduledResult(
    assignedSlotRef: string,
    usedFallbackSlot: boolean,
    specialtyName: string,
    patientDetails: PatientAppointmentConfirmationDetails,
  ): Promise<RescheduleAssignedAppointmentByPatientResult> {
    const assignedAppointment =
      await this.appointmentConfirmationDetailsRepository.findAssignedAppointmentBySlotRef(
        assignedSlotRef,
      );

    if (!assignedAppointment) {
      return {
        status: 'TECHNICAL_FAILURE',
        reason: 'ASSIGNED_SLOT_NOT_FOUND',
      };
    }

    return {
      status: 'RESCHEDULED',
      appointment: {
        slotRef: assignedAppointment.slotRef,
        specialtyName,
        patientFullName: this.buildPatientFullName(patientDetails),
        appointmentDateIso: assignedAppointment.appointmentDateIso,
        appointmentTimeHHmm: assignedAppointment.appointmentTimeHHmm,
        appointmentDisplayTime: this.appointmentTimePresenterService.formatHHmmAsTwelveHour(
          assignedAppointment.appointmentTimeHHmm,
        ),
        professionalName:
          assignedAppointment.professionalName?.trim() ||
          RescheduleAssignedAppointmentByPatientUseCase.DEFAULT_PROFESSIONAL_NAME,
        siteName:
          assignedAppointment.siteName?.trim() ||
          RescheduleAssignedAppointmentByPatientUseCase.DEFAULT_SITE_NAME,
        siteAddress:
          assignedAppointment.siteAddress?.trim() ||
          RescheduleAssignedAppointmentByPatientUseCase.DEFAULT_SITE_ADDRESS,
        usedFallbackSlot,
      },
    };
  }

  private normalizeInput(
    input: RescheduleAssignedAppointmentByPatientInput,
  ):
    | {
        patientId: number;
        originalSlotRef: string;
        specialtyName: string;
        specialtyCups: string;
        appointmentDateIso: string;
        appointmentTimeHHmm: string;
        preferredNewSlotRef: string;
        doctorEmployeeCode?: string;
        now: Date;
      }
    | null {
    const patientId = input.patientId ?? null;
    const originalSlotRef = input.originalSlotRef?.trim() ?? '';
    const specialtyName = input.specialtyName?.trim() ?? '';
    const specialtyCups = input.specialtyCups?.trim() ?? '';
    const appointmentDateIso = input.appointmentDateIso?.trim() ?? '';
    const appointmentTimeHHmm = input.appointmentTimeHHmm?.trim() ?? '';
    const preferredNewSlotRef = input.preferredNewSlotRef?.trim() ?? '';
    const doctorEmployeeCode = input.doctorEmployeeCode?.trim() || undefined;
    const now = input.now ?? new Date();

    if (
      typeof patientId !== 'number' ||
      !Number.isInteger(patientId) ||
      patientId <= 0 ||
      !originalSlotRef ||
      !specialtyName ||
      !specialtyCups ||
      !preferredNewSlotRef ||
      !RescheduleAssignedAppointmentByPatientUseCase.ISO_DATE_PATTERN.test(appointmentDateIso) ||
      !RescheduleAssignedAppointmentByPatientUseCase.TIME_HHMM_PATTERN.test(
        appointmentTimeHHmm,
      )
    ) {
      return null;
    }

    return {
      patientId,
      originalSlotRef,
      specialtyName,
      specialtyCups,
      appointmentDateIso,
      appointmentTimeHHmm,
      preferredNewSlotRef,
      doctorEmployeeCode,
      now,
    };
  }

  private formatNowInBogota(now: Date): { dateIso: string; timeHHmm: string } {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: RescheduleAssignedAppointmentByPatientUseCase.TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    });

    const parts = formatter
      .formatToParts(now)
      .filter((part) =>
        ['year', 'month', 'day', 'hour', 'minute'].includes(part.type),
      )
      .map((part) => [part.type, part.value] as const);
    const normalizedParts = Object.fromEntries(parts) as Record<
      'year' | 'month' | 'day' | 'hour' | 'minute',
      string
    >;

    const dateIso = `${normalizedParts.year}-${normalizedParts.month}-${normalizedParts.day}`;
    const timeHHmm = `${normalizedParts.hour}:${normalizedParts.minute}`;

    if (
      !RescheduleAssignedAppointmentByPatientUseCase.ISO_DATE_PATTERN.test(dateIso) ||
      !RescheduleAssignedAppointmentByPatientUseCase.TIME_HHMM_PATTERN.test(timeHHmm)
    ) {
      throw new Error('Failed to compute valid Bogota date/time.');
    }

    return {
      dateIso,
      timeHHmm,
    };
  }

  private normalizePhone(phone: string | null): string {
    const normalizedPhone = phone?.trim() ?? '';
    return normalizedPhone || RescheduleAssignedAppointmentByPatientUseCase.DEFAULT_PATIENT_PHONE;
  }

  private buildPatientFullName(patientDetails: PatientAppointmentConfirmationDetails): string {
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
