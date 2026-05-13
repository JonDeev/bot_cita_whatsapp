import { Inject, Injectable } from '@nestjs/common';
import { APPOINTMENT_AVAILABILITY_REPOSITORY } from '../../domain/appointments.tokens';
import type {
  AppointmentAvailabilityRepository,
  AvailableAppointmentDateCandidate,
} from '../../domain/ports/appointment-availability.repository';
import { AppointmentAvailabilityCutoffService } from '../services/appointment-availability-cutoff.service';
import { AppointmentDatePresenterService } from '../services/appointment-date-presenter.service';

export interface ResolveAvailableAppointmentDatesBySpecialtyInput {
  specialtyCups?: string | null;
  doctorEmployeeCode?: string | null;
  now?: Date;
}

export interface AvailableAppointmentDate {
  isoDate: string;
  displayDate: string;
}

export type ResolveAvailableAppointmentDatesBySpecialtyFailureReason =
  | 'SPECIALTY_CUPS_MISSING'
  | 'NO_AVAILABILITY';

export type ResolveAvailableAppointmentDatesBySpecialtyResult =
  | {
      hasAvailability: true;
      dates: AvailableAppointmentDate[];
    }
  | {
      hasAvailability: false;
      reason: ResolveAvailableAppointmentDatesBySpecialtyFailureReason;
      dates: [];
    };

@Injectable()
export class ResolveAvailableAppointmentDatesBySpecialtyUseCase {
  private static readonly MAX_AVAILABLE_DATES = 5;

  constructor(
    @Inject(APPOINTMENT_AVAILABILITY_REPOSITORY)
    private readonly appointmentAvailabilityRepository: AppointmentAvailabilityRepository,
    private readonly appointmentAvailabilityCutoffService: AppointmentAvailabilityCutoffService,
    private readonly appointmentDatePresenterService: AppointmentDatePresenterService,
  ) {}

  async execute(
    input: ResolveAvailableAppointmentDatesBySpecialtyInput,
  ): Promise<ResolveAvailableAppointmentDatesBySpecialtyResult> {
    const specialtyCups = input.specialtyCups?.trim();
    if (!specialtyCups) {
      return {
        hasAvailability: false,
        reason: 'SPECIALTY_CUPS_MISSING',
        dates: [],
      };
    }

    const cutoff = this.appointmentAvailabilityCutoffService.build(
      input.now ?? new Date(),
    );
    const doctorEmployeeCode = input.doctorEmployeeCode?.trim() || undefined;
    const candidates =
      await this.appointmentAvailabilityRepository.findAvailableDates({
        specialtyCups,
        cutoffDateIso: cutoff.cutoffDateIso,
        cutoffTimeHHmm: cutoff.cutoffTimeHHmm,
        doctorEmployeeCode,
      });

    const dates = this.pickUniqueDates(candidates);
    if (dates.length === 0) {
      return {
        hasAvailability: false,
        reason: 'NO_AVAILABILITY',
        dates: [],
      };
    }

    return {
      hasAvailability: true,
      dates,
    };
  }

  private pickUniqueDates(
    candidates: AvailableAppointmentDateCandidate[],
  ): AvailableAppointmentDate[] {
    const uniqueDates = new Set<string>();
    const selectedDates: AvailableAppointmentDate[] = [];

    for (const candidate of candidates) {
      const dateIso = candidate.dateIso.trim();
      if (!dateIso || uniqueDates.has(dateIso)) {
        continue;
      }

      uniqueDates.add(dateIso);
      selectedDates.push({
        isoDate: dateIso,
        displayDate:
          this.appointmentDatePresenterService.formatIsoDate(dateIso),
      });

      if (
        selectedDates.length ===
        ResolveAvailableAppointmentDatesBySpecialtyUseCase.MAX_AVAILABLE_DATES
      ) {
        break;
      }
    }

    return selectedDates;
  }
}
