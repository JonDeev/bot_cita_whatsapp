import { Inject, Injectable } from '@nestjs/common';
import { APPOINTMENT_PENDING_CHECK_REPOSITORY } from '../../domain/appointments.tokens';
import type { PendingAppointmentCheckRepository } from '../../domain/ports/pending-appointment-check.repository';
import { AppointmentTimePresenterService } from '../services/appointment-time-presenter.service';

export interface FindNearestPendingFutureAppointmentByPatientAndSpecialtyInput {
  patientId?: number | null;
  specialtyCups?: string | null;
  now?: Date;
}

export interface PendingFutureAppointmentDetails {
  slotRef: string;
  patientFullName: string;
  appointmentDateIso: string;
  appointmentTimeHHmm: string;
  appointmentDisplayTime: string;
  modality: string;
  professionalName: string;
  siteName: string;
  siteAddress: string;
}

export type FindNearestPendingFutureAppointmentByPatientAndSpecialtyResult =
  | {
      status: 'FOUND';
      appointment: PendingFutureAppointmentDetails;
    }
  | {
      status: 'NOT_FOUND';
    }
  | {
      status: 'TECHNICAL_FAILURE';
      reason: 'INVALID_INPUT' | 'UNEXPECTED_ERROR';
    };

@Injectable()
export class FindNearestPendingFutureAppointmentByPatientAndSpecialtyUseCase {
  private static readonly TIMEZONE = 'America/Bogota';
  private static readonly ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
  private static readonly TIME_HHMM_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;
  private static readonly DEFAULT_PATIENT_NAME = 'PACIENTE';

  constructor(
    @Inject(APPOINTMENT_PENDING_CHECK_REPOSITORY)
    private readonly pendingAppointmentCheckRepository: PendingAppointmentCheckRepository,
    private readonly appointmentTimePresenterService: AppointmentTimePresenterService,
  ) {}

  async execute(
    input: FindNearestPendingFutureAppointmentByPatientAndSpecialtyInput,
  ): Promise<FindNearestPendingFutureAppointmentByPatientAndSpecialtyResult> {
    const normalizedInput = this.normalizeInput(input);
    if (!normalizedInput) {
      return {
        status: 'TECHNICAL_FAILURE',
        reason: 'INVALID_INPUT',
      };
    }

    try {
      const nowParts = this.formatNowInBogota(normalizedInput.now);
      const candidate =
        await this.pendingAppointmentCheckRepository.findNearestPendingFutureAppointmentByPatientAndSpecialty(
          {
            patientUserId: String(normalizedInput.patientId),
            specialtyCups: normalizedInput.specialtyCups,
            currentDateIso: nowParts.dateIso,
            currentTimeHHmm: nowParts.timeHHmm,
          },
        );

      if (!candidate) {
        return { status: 'NOT_FOUND' };
      }

      return {
        status: 'FOUND',
        appointment: {
          slotRef: candidate.slotRef,
          patientFullName: this.buildPatientFullName(candidate),
          appointmentDateIso: candidate.appointmentDateIso,
          appointmentTimeHHmm: candidate.appointmentTimeHHmm,
          appointmentDisplayTime:
            this.appointmentTimePresenterService.formatHHmmAsTwelveHour(
              candidate.appointmentTimeHHmm,
            ),
          modality: candidate.modalityId === 0 ? 'PRESENCIAL' : '',
          professionalName: candidate.professionalName?.trim() ?? '',
          siteName: candidate.siteName?.trim() ?? '',
          siteAddress: candidate.siteAddress?.trim() ?? '',
        },
      };
    } catch {
      return {
        status: 'TECHNICAL_FAILURE',
        reason: 'UNEXPECTED_ERROR',
      };
    }
  }

  private normalizeInput(
    input: FindNearestPendingFutureAppointmentByPatientAndSpecialtyInput,
  ): { patientId: number; specialtyCups: string; now: Date } | null {
    const patientId = input.patientId ?? null;
    const specialtyCups = input.specialtyCups?.trim() ?? '';
    const now = input.now ?? new Date();

    if (
      typeof patientId !== 'number' ||
      !Number.isInteger(patientId) ||
      patientId <= 0 ||
      !specialtyCups
    ) {
      return null;
    }

    return {
      patientId,
      specialtyCups,
      now,
    };
  }

  private formatNowInBogota(now: Date): { dateIso: string; timeHHmm: string } {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone:
        FindNearestPendingFutureAppointmentByPatientAndSpecialtyUseCase.TIMEZONE,
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
      !FindNearestPendingFutureAppointmentByPatientAndSpecialtyUseCase.ISO_DATE_PATTERN.test(
        dateIso,
      ) ||
      !FindNearestPendingFutureAppointmentByPatientAndSpecialtyUseCase.TIME_HHMM_PATTERN.test(
        timeHHmm,
      )
    ) {
      throw new Error('Failed to compute valid Bogota date/time.');
    }

    return { dateIso, timeHHmm };
  }

  private buildPatientFullName(candidate: {
    patientFirstName: string | null;
    patientSecondName: string | null;
    patientFirstLastName: string | null;
    patientSecondLastName: string | null;
  }): string {
    const fullName = [
      candidate.patientFirstName,
      candidate.patientSecondName,
      candidate.patientFirstLastName,
      candidate.patientSecondLastName,
    ]
      .map((part) => part?.trim() ?? '')
      .filter((part) => part.length > 0)
      .join(' ')
      .trim();

    return (
      fullName ||
      FindNearestPendingFutureAppointmentByPatientAndSpecialtyUseCase.DEFAULT_PATIENT_NAME
    );
  }
}
