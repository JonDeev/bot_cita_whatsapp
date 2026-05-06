import { Inject, Injectable } from '@nestjs/common';
import { APPOINTMENT_AVAILABILITY_REPOSITORY } from '../../domain/appointments.tokens';
import type {
  AppointmentAvailabilityRepository,
  AvailableAppointmentTimeCandidate,
} from '../../domain/ports/appointment-availability.repository';
import { AppointmentAvailabilityCutoffService } from '../services/appointment-availability-cutoff.service';
import { AppointmentTimePresenterService } from '../services/appointment-time-presenter.service';

export interface ResolveAvailableAppointmentTimesBySpecialtyAndDateInput {
  specialtyCups?: string | null;
  appointmentDateIso?: string | null;
  afterTimeHHmmExclusive?: string | null;
  doctorEmployeeCode?: string | null;
  now?: Date;
}

export interface AvailableAppointmentTime {
  slotRef: string;
  timeHHmm: string;
  displayTime: string;
}

export type ResolveAvailableAppointmentTimesBySpecialtyAndDateFailureReason =
  | 'SPECIALTY_CUPS_MISSING'
  | 'APPOINTMENT_DATE_MISSING'
  | 'NO_AVAILABILITY';

export type ResolveAvailableAppointmentTimesBySpecialtyAndDateResult =
  | {
      hasAvailability: true;
      times: AvailableAppointmentTime[];
      hasMore: boolean;
      nextCursorTimeHHmm?: string;
    }
  | {
      hasAvailability: false;
      reason: ResolveAvailableAppointmentTimesBySpecialtyAndDateFailureReason;
      times: [];
    };

@Injectable()
export class ResolveAvailableAppointmentTimesBySpecialtyAndDateUseCase {
  private static readonly PAGE_SIZE = 9;
  private static readonly LOOKAHEAD_SIZE = 1;
  private static readonly QUERY_LIMIT =
    ResolveAvailableAppointmentTimesBySpecialtyAndDateUseCase.PAGE_SIZE +
    ResolveAvailableAppointmentTimesBySpecialtyAndDateUseCase.LOOKAHEAD_SIZE;
  private static readonly DAY_START_TIME = '00:00';
  private static readonly ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
  private static readonly TIME_HHMM_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

  constructor(
    @Inject(APPOINTMENT_AVAILABILITY_REPOSITORY)
    private readonly appointmentAvailabilityRepository: AppointmentAvailabilityRepository,
    private readonly appointmentAvailabilityCutoffService: AppointmentAvailabilityCutoffService,
    private readonly appointmentTimePresenterService: AppointmentTimePresenterService,
  ) {}

  async execute(
    input: ResolveAvailableAppointmentTimesBySpecialtyAndDateInput,
  ): Promise<ResolveAvailableAppointmentTimesBySpecialtyAndDateResult> {
    const specialtyCups = input.specialtyCups?.trim();
    if (!specialtyCups) {
      return {
        hasAvailability: false,
        reason: 'SPECIALTY_CUPS_MISSING',
        times: [],
      };
    }

    const appointmentDateIso = input.appointmentDateIso?.trim();
    if (!appointmentDateIso || !this.isIsoDate(appointmentDateIso)) {
      return {
        hasAvailability: false,
        reason: 'APPOINTMENT_DATE_MISSING',
        times: [],
      };
    }

    const cutoff = this.appointmentAvailabilityCutoffService.build(input.now ?? new Date());
    if (appointmentDateIso < cutoff.cutoffDateIso) {
      return {
        hasAvailability: false,
        reason: 'NO_AVAILABILITY',
        times: [],
      };
    }

    const minimumTimeHHmm =
      appointmentDateIso === cutoff.cutoffDateIso
        ? cutoff.cutoffTimeHHmm
        : ResolveAvailableAppointmentTimesBySpecialtyAndDateUseCase.DAY_START_TIME;
    const paginationCursorTime = this.normalizeTimeHHmm(input.afterTimeHHmmExclusive);
    const doctorEmployeeCode = input.doctorEmployeeCode?.trim() || undefined;

    const candidates = await this.appointmentAvailabilityRepository.findAvailableTimesByDate({
      specialtyCups,
      dateIso: appointmentDateIso,
      minimumTimeHHmm,
      afterTimeHHmmExclusive: paginationCursorTime ?? undefined,
      doctorEmployeeCode,
      maxResults: ResolveAvailableAppointmentTimesBySpecialtyAndDateUseCase.QUERY_LIMIT,
    });

    const uniqueTimes = this.pickUniqueTimes(candidates);
    if (uniqueTimes.length === 0) {
      return {
        hasAvailability: false,
        reason: 'NO_AVAILABILITY',
        times: [],
      };
    }

    const pageBoundary =
      ResolveAvailableAppointmentTimesBySpecialtyAndDateUseCase.PAGE_SIZE +
      ResolveAvailableAppointmentTimesBySpecialtyAndDateUseCase.LOOKAHEAD_SIZE;
    const pagedTimes = uniqueTimes.slice(0, pageBoundary);
    const times = pagedTimes.slice(0, ResolveAvailableAppointmentTimesBySpecialtyAndDateUseCase.PAGE_SIZE);
    const hasMore = pagedTimes.length > ResolveAvailableAppointmentTimesBySpecialtyAndDateUseCase.PAGE_SIZE;
    const nextCursorTimeHHmm = times.at(-1)?.timeHHmm;

    return {
      hasAvailability: true,
      times,
      hasMore,
      nextCursorTimeHHmm: hasMore ? nextCursorTimeHHmm : undefined,
    };
  }

  private pickUniqueTimes(candidates: AvailableAppointmentTimeCandidate[]): AvailableAppointmentTime[] {
    const includedTimes = new Set<string>();
    const selectedTimes: AvailableAppointmentTime[] = [];

    for (const candidate of candidates) {
      const slotRef = candidate.slotRef.trim();
      const timeHHmm = candidate.timeHHmm.trim();
      if (!slotRef || !timeHHmm || includedTimes.has(timeHHmm)) {
        continue;
      }

      includedTimes.add(timeHHmm);
      selectedTimes.push({
        slotRef,
        timeHHmm,
        displayTime: this.appointmentTimePresenterService.formatHHmmAsTwelveHour(timeHHmm),
      });

      if (
        selectedTimes.length ===
        ResolveAvailableAppointmentTimesBySpecialtyAndDateUseCase.PAGE_SIZE +
          ResolveAvailableAppointmentTimesBySpecialtyAndDateUseCase.LOOKAHEAD_SIZE
      ) {
        break;
      }
    }

    return selectedTimes;
  }

  private isIsoDate(value: string): boolean {
    return ResolveAvailableAppointmentTimesBySpecialtyAndDateUseCase.ISO_DATE_PATTERN.test(value);
  }

  private normalizeTimeHHmm(value: string | null | undefined): string | null {
    const normalized = value?.trim() ?? '';
    if (!normalized) {
      return null;
    }

    if (!ResolveAvailableAppointmentTimesBySpecialtyAndDateUseCase.TIME_HHMM_PATTERN.test(normalized)) {
      return null;
    }

    return normalized;
  }
}
