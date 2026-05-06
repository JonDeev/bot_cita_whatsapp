import { Inject, Injectable } from '@nestjs/common';
import { CONTRACTED_EPS_REPOSITORY, PATIENT_SPECIALTY_ELIGIBILITY_REPOSITORY } from '../../domain/patients.tokens';
import type { ContractedEpsRepository } from '../../domain/ports/contracted-eps.repository';
import type {
  EligibleSpecialtyRecord,
  PatientSpecialtyEligibilityRepository,
} from '../../domain/ports/patient-specialty-eligibility.repository';

export interface ResolveEligibleSpecialtiesByPatientInput {
  epsCode: string;
  userType: string;
  sex: string;
}

export type ResolveEligibleSpecialtiesByPatientFailureReason =
  | 'INVALID_PATIENT_PROFILE'
  | 'EPS_NOT_ALLOWED'
  | 'NO_SPECIALTIES_AVAILABLE';

export type ResolveEligibleSpecialtiesByPatientResult =
  | {
      isEligible: true;
      specialties: EligibleSpecialtyRecord[];
    }
  | {
      isEligible: false;
      reason: ResolveEligibleSpecialtiesByPatientFailureReason;
    };

@Injectable()
export class ResolveEligibleSpecialtiesByPatientUseCase {
  constructor(
    @Inject(CONTRACTED_EPS_REPOSITORY)
    private readonly contractedEpsRepository: ContractedEpsRepository,
    @Inject(PATIENT_SPECIALTY_ELIGIBILITY_REPOSITORY)
    private readonly patientSpecialtyEligibilityRepository: PatientSpecialtyEligibilityRepository,
  ) {}

  async execute(
    input: ResolveEligibleSpecialtiesByPatientInput,
  ): Promise<ResolveEligibleSpecialtiesByPatientResult> {
    const epsCode = input.epsCode.trim().toUpperCase();
    const userType = input.userType.trim().toUpperCase();
    const sex = input.sex.trim().toUpperCase();

    if (!epsCode || !userType || (sex !== 'H' && sex !== 'M')) {
      return { isEligible: false, reason: 'INVALID_PATIENT_PROFILE' };
    }

    const isAllowedEps = await this.contractedEpsRepository.isCodeAllowed(epsCode);
    if (!isAllowedEps) {
      return { isEligible: false, reason: 'EPS_NOT_ALLOWED' };
    }

    const specialties = await this.patientSpecialtyEligibilityRepository.findEligibleSpecialties({
      epsCode,
      userType,
      sex,
    });

    if (specialties.length === 0) {
      return { isEligible: false, reason: 'NO_SPECIALTIES_AVAILABLE' };
    }

    return {
      isEligible: true,
      specialties,
    };
  }
}
