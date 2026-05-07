import { Inject, Injectable } from '@nestjs/common';
import {
  APPOINTMENT_ASSIGNED_LIST_REPOSITORY,
  APPOINTMENT_CONFIRMATION_DETAILS_REPOSITORY,
} from '../../domain/appointments.tokens';
import type { AppointmentConfirmationDetailsRepository } from '../../domain/ports/appointment-confirmation-details.repository';
import type { PatientAssignedAppointmentRepository } from '../../domain/ports/patient-assigned-appointment.repository';
import { AppointmentTimePresenterService } from '../services/appointment-time-presenter.service';

export interface ListFutureAssignedAppointmentsByPatientInput {
  patientId?: number | null;
  offset?: number | null;
  now?: Date;
}

export interface ListedFutureAssignedAppointment {
  slotRef: string;
  specialtyName: string;
  specialtyCups?: string;
  professionalName: string;
  appointmentDateIso: string;
  appointmentTimeHHmm: string;
  appointmentDisplayTime: string;
}

export type ListFutureAssignedAppointmentsByPatientResult =
  | {
      status: 'FOUND';
      patientFullName: string;
      appointments: ListedFutureAssignedAppointment[];
      hasMore: boolean;
      currentOffset: number;
      nextOffset?: number;
    }
  | {
      status: 'EMPTY';
      patientFullName: string;
      currentOffset: number;
    }
  | {
      status: 'TECHNICAL_FAILURE';
      reason: 'INVALID_INPUT' | 'PATIENT_NOT_FOUND' | 'UNEXPECTED_ERROR';
    };

@Injectable()
export class ListFutureAssignedAppointmentsByPatientUseCase {
  private static readonly TIMEZONE = 'America/Bogota';
  private static readonly ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
  private static readonly TIME_HHMM_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;
  private static readonly MAX_QUERY_ROWS = 11;
  private static readonly MAX_VISIBLE_ROWS = 10;
  private static readonly MAX_VISIBLE_ROWS_WHEN_HAS_MORE = 9;
  private static readonly DEFAULT_SPECIALTY_NAME = 'ESPECIALIDAD POR CONFIRMAR';
  private static readonly DEFAULT_PROFESSIONAL_NAME = 'PROFESIONAL POR CONFIRMAR';

  constructor(
    @Inject(APPOINTMENT_ASSIGNED_LIST_REPOSITORY)
    private readonly patientAssignedAppointmentRepository: PatientAssignedAppointmentRepository,
    @Inject(APPOINTMENT_CONFIRMATION_DETAILS_REPOSITORY)
    private readonly appointmentConfirmationDetailsRepository: AppointmentConfirmationDetailsRepository,
    private readonly appointmentTimePresenterService: AppointmentTimePresenterService,
  ) {}

  async execute(
    input: ListFutureAssignedAppointmentsByPatientInput,
  ): Promise<ListFutureAssignedAppointmentsByPatientResult> {
    const normalizedInput = this.normalizeInput(input);
    if (!normalizedInput) {
      return {
        status: 'TECHNICAL_FAILURE',
        reason: 'INVALID_INPUT',
      };
    }

    try {
      const patient = await this.appointmentConfirmationDetailsRepository.findPatientById(
        normalizedInput.patientId,
      );
      if (!patient) {
        return {
          status: 'TECHNICAL_FAILURE',
          reason: 'PATIENT_NOT_FOUND',
        };
      }

      const nowParts = this.formatNowInBogota(normalizedInput.now);
      const candidates =
        await this.patientAssignedAppointmentRepository.findFutureAssignedAppointmentsByPatient({
          patientUserId: String(normalizedInput.patientId),
          currentDateIso: nowParts.dateIso,
          currentTimeHHmm: nowParts.timeHHmm,
          offset: normalizedInput.offset,
          maxResults: ListFutureAssignedAppointmentsByPatientUseCase.MAX_QUERY_ROWS,
        });

      const patientFullName = this.buildPatientFullName({
        firstName: patient.firstName,
        secondName: patient.secondName,
        firstLastName: patient.firstLastName,
        secondLastName: patient.secondLastName,
      });

      if (candidates.length === 0) {
        return {
          status: 'EMPTY',
          patientFullName,
          currentOffset: normalizedInput.offset,
        };
      }

      const hasMore =
        candidates.length > ListFutureAssignedAppointmentsByPatientUseCase.MAX_VISIBLE_ROWS;
      const visibleCandidates = hasMore
        ? candidates.slice(0, ListFutureAssignedAppointmentsByPatientUseCase.MAX_VISIBLE_ROWS_WHEN_HAS_MORE)
        : candidates.slice(0, ListFutureAssignedAppointmentsByPatientUseCase.MAX_VISIBLE_ROWS);

      return {
        status: 'FOUND',
        patientFullName,
        appointments: visibleCandidates.map((candidate) => ({
          slotRef: candidate.slotRef,
          specialtyName: this.normalizeSpecialtyName(candidate.specialtyName),
          specialtyCups: candidate.specialtyCups?.trim() || undefined,
          professionalName:
            candidate.professionalName?.trim() ||
            ListFutureAssignedAppointmentsByPatientUseCase.DEFAULT_PROFESSIONAL_NAME,
          appointmentDateIso: candidate.appointmentDateIso,
          appointmentTimeHHmm: candidate.appointmentTimeHHmm,
          appointmentDisplayTime: this.appointmentTimePresenterService.formatHHmmAsTwelveHour(
            candidate.appointmentTimeHHmm,
          ),
        })),
        hasMore,
        currentOffset: normalizedInput.offset,
        nextOffset: hasMore
          ? normalizedInput.offset +
            ListFutureAssignedAppointmentsByPatientUseCase.MAX_VISIBLE_ROWS_WHEN_HAS_MORE
          : undefined,
      };
    } catch {
      return {
        status: 'TECHNICAL_FAILURE',
        reason: 'UNEXPECTED_ERROR',
      };
    }
  }

  private normalizeInput(
    input: ListFutureAssignedAppointmentsByPatientInput,
  ): { patientId: number; offset: number; now: Date } | null {
    const patientId = input.patientId ?? null;
    const offset = input.offset ?? 0;
    const now = input.now ?? new Date();

    if (
      typeof patientId !== 'number' ||
      !Number.isInteger(patientId) ||
      patientId <= 0 ||
      typeof offset !== 'number' ||
      !Number.isInteger(offset) ||
      offset < 0
    ) {
      return null;
    }

    return { patientId, offset, now };
  }

  private formatNowInBogota(now: Date): { dateIso: string; timeHHmm: string } {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: ListFutureAssignedAppointmentsByPatientUseCase.TIMEZONE,
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
      !ListFutureAssignedAppointmentsByPatientUseCase.ISO_DATE_PATTERN.test(dateIso) ||
      !ListFutureAssignedAppointmentsByPatientUseCase.TIME_HHMM_PATTERN.test(timeHHmm)
    ) {
      throw new Error('Failed to compute valid Bogota date/time.');
    }

    return {
      dateIso,
      timeHHmm,
    };
  }

  private buildPatientFullName(parts: {
    firstName: string;
    secondName: string | null;
    firstLastName: string;
    secondLastName: string | null;
  }): string {
    const fullName = [
      parts.firstName,
      parts.secondName,
      parts.firstLastName,
      parts.secondLastName,
    ]
      .map((part) => part?.trim() ?? '')
      .filter((part) => part.length > 0)
      .join(' ')
      .trim();

    return fullName || 'PACIENTE';
  }

  private normalizeSpecialtyName(rawName: string | null): string {
    const normalized = rawName?.trim() ?? '';
    if (!normalized) {
      return ListFutureAssignedAppointmentsByPatientUseCase.DEFAULT_SPECIALTY_NAME;
    }

    const withoutCodePrefix = normalized.replace(/^\d+\s*-\s*/, '').trim();
    return withoutCodePrefix || ListFutureAssignedAppointmentsByPatientUseCase.DEFAULT_SPECIALTY_NAME;
  }
}
