import { Inject, Injectable } from '@nestjs/common';
import { APPOINTMENT_AVAILABILITY_REPOSITORY } from '../../domain/appointments.tokens';
import type {
  AppointmentAvailabilityRepository,
  AvailableAppointmentDoctorCandidate,
} from '../../domain/ports/appointment-availability.repository';
import { AppointmentAvailabilityCutoffService } from '../services/appointment-availability-cutoff.service';

export interface ResolveAvailableAppointmentDoctorsBySpecialtyInput {
  specialtyCups?: string | null;
  now?: Date;
}

export interface AvailableAppointmentDoctor {
  employeeCode: string;
  displayName: string;
}

export type ResolveAvailableAppointmentDoctorsBySpecialtyFailureReason =
  | 'SPECIALTY_CUPS_MISSING'
  | 'NO_AVAILABILITY';

export type ResolveAvailableAppointmentDoctorsBySpecialtyResult =
  | {
      hasAvailability: true;
      doctors: AvailableAppointmentDoctor[];
    }
  | {
      hasAvailability: false;
      reason: ResolveAvailableAppointmentDoctorsBySpecialtyFailureReason;
      doctors: [];
    };

@Injectable()
export class ResolveAvailableAppointmentDoctorsBySpecialtyUseCase {
  private static readonly MAX_AVAILABLE_DOCTORS = 9;

  constructor(
    @Inject(APPOINTMENT_AVAILABILITY_REPOSITORY)
    private readonly appointmentAvailabilityRepository: AppointmentAvailabilityRepository,
    private readonly appointmentAvailabilityCutoffService: AppointmentAvailabilityCutoffService,
  ) {}

  async execute(
    input: ResolveAvailableAppointmentDoctorsBySpecialtyInput,
  ): Promise<ResolveAvailableAppointmentDoctorsBySpecialtyResult> {
    const specialtyCups = input.specialtyCups?.trim();
    if (!specialtyCups) {
      return {
        hasAvailability: false,
        reason: 'SPECIALTY_CUPS_MISSING',
        doctors: [],
      };
    }

    const cutoff = this.appointmentAvailabilityCutoffService.build(input.now ?? new Date());
    const candidates = await this.appointmentAvailabilityRepository.findAvailableDoctors({
      specialtyCups,
      cutoffDateIso: cutoff.cutoffDateIso,
      cutoffTimeHHmm: cutoff.cutoffTimeHHmm,
      maxResults: ResolveAvailableAppointmentDoctorsBySpecialtyUseCase.MAX_AVAILABLE_DOCTORS,
    });

    const doctors = this.pickUniqueDoctors(candidates);
    if (doctors.length === 0) {
      return {
        hasAvailability: false,
        reason: 'NO_AVAILABILITY',
        doctors: [],
      };
    }

    return {
      hasAvailability: true,
      doctors,
    };
  }

  private pickUniqueDoctors(
    candidates: AvailableAppointmentDoctorCandidate[],
  ): AvailableAppointmentDoctor[] {
    const includedEmployeeCodes = new Set<string>();
    const selectedDoctors: AvailableAppointmentDoctor[] = [];

    for (const candidate of candidates) {
      const employeeCode = candidate.employeeCode.trim();
      if (!employeeCode || includedEmployeeCodes.has(employeeCode)) {
        continue;
      }

      includedEmployeeCodes.add(employeeCode);
      selectedDoctors.push({
        employeeCode,
        displayName: this.buildDoctorDisplayName(candidate.professionalName, employeeCode),
      });

      if (
        selectedDoctors.length ===
        ResolveAvailableAppointmentDoctorsBySpecialtyUseCase.MAX_AVAILABLE_DOCTORS
      ) {
        break;
      }
    }

    return selectedDoctors;
  }

  private buildDoctorDisplayName(professionalName: string, employeeCode: string): string {
    const normalizedName = professionalName.trim();
    if (normalizedName) {
      return normalizedName;
    }

    return `MEDICO ${employeeCode}`;
  }
}
