import { Inject, Injectable } from '@nestjs/common';
import { APPOINTMENT_CANCELLATION_REPOSITORY } from '../../domain/appointments.tokens';
import type { AppointmentCancellationRepository } from '../../domain/ports/appointment-cancellation.repository';

export interface CancelAssignedAppointmentByPatientInput {
  patientId?: number | null;
  slotRef?: string | null;
  now?: Date;
}

export type CancelAssignedAppointmentByPatientResult =
  | {
      status: 'CANCELLED';
    }
  | {
      status: 'NOT_CANCELLABLE';
    }
  | {
      status: 'TECHNICAL_FAILURE';
      reason: 'INVALID_INPUT' | 'UNEXPECTED_ERROR';
    };

@Injectable()
export class CancelAssignedAppointmentByPatientUseCase {
  private static readonly TIMEZONE = 'America/Bogota';
  private static readonly ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
  private static readonly TIME_HHMM_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

  constructor(
    @Inject(APPOINTMENT_CANCELLATION_REPOSITORY)
    private readonly appointmentCancellationRepository: AppointmentCancellationRepository,
  ) {}

  async execute(
    input: CancelAssignedAppointmentByPatientInput,
  ): Promise<CancelAssignedAppointmentByPatientResult> {
    const normalizedInput = this.normalizeInput(input);
    if (!normalizedInput) {
      return {
        status: 'TECHNICAL_FAILURE',
        reason: 'INVALID_INPUT',
      };
    }

    try {
      const nowParts = this.formatNowInBogota(normalizedInput.now);
      const wasCancelled =
        await this.appointmentCancellationRepository.cancelAssignedFutureAppointmentByPatient(
          {
            slotRef: normalizedInput.slotRef,
            patientUserId: String(normalizedInput.patientId),
            currentDateIso: nowParts.dateIso,
            currentTimeHHmm: nowParts.timeHHmm,
            canceledDateIso: nowParts.dateIso,
          },
        );

      return wasCancelled
        ? { status: 'CANCELLED' }
        : { status: 'NOT_CANCELLABLE' };
    } catch {
      return {
        status: 'TECHNICAL_FAILURE',
        reason: 'UNEXPECTED_ERROR',
      };
    }
  }

  private normalizeInput(
    input: CancelAssignedAppointmentByPatientInput,
  ): { patientId: number; slotRef: string; now: Date } | null {
    const patientId = input.patientId ?? null;
    const slotRef = input.slotRef?.trim() ?? '';
    const now = input.now ?? new Date();

    if (
      typeof patientId !== 'number' ||
      !Number.isInteger(patientId) ||
      patientId <= 0 ||
      !slotRef
    ) {
      return null;
    }

    return { patientId, slotRef, now };
  }

  private formatNowInBogota(now: Date): { dateIso: string; timeHHmm: string } {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: CancelAssignedAppointmentByPatientUseCase.TIMEZONE,
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
      !CancelAssignedAppointmentByPatientUseCase.ISO_DATE_PATTERN.test(
        dateIso,
      ) ||
      !CancelAssignedAppointmentByPatientUseCase.TIME_HHMM_PATTERN.test(
        timeHHmm,
      )
    ) {
      throw new Error('Failed to compute valid Bogota date/time.');
    }

    return {
      dateIso,
      timeHHmm,
    };
  }
}
