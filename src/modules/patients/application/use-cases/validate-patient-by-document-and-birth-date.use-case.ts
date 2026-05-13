import { Inject, Injectable } from '@nestjs/common';
import {
  CONTRACTED_EPS_REPOSITORY,
  PATIENT_VALIDATION_REPOSITORY,
} from '../../domain/patients.tokens';
import type { ContractedEpsRepository } from '../../domain/ports/contracted-eps.repository';
import type { PatientValidationRepository } from '../../domain/ports/patient-validation.repository';

export type PatientValidationFailureReason =
  | 'NOT_FOUND_OR_MISMATCH'
  | 'INACTIVE_PATIENT'
  | 'EPS_NOT_ALLOWED';

export type ValidatePatientByDocumentAndBirthDateResult =
  | {
      isValid: true;
      patientId: number;
      epsCode: string;
      userType: string;
      sex: 'H' | 'M';
    }
  | {
      isValid: false;
      reason: PatientValidationFailureReason;
    };

export interface ValidatePatientByDocumentAndBirthDateInput {
  documentNumber: string;
  birthDateIso: string;
}

@Injectable()
export class ValidatePatientByDocumentAndBirthDateUseCase {
  constructor(
    @Inject(PATIENT_VALIDATION_REPOSITORY)
    private readonly patientValidationRepository: PatientValidationRepository,
    @Inject(CONTRACTED_EPS_REPOSITORY)
    private readonly contractedEpsRepository: ContractedEpsRepository,
  ) {}

  async execute(
    input: ValidatePatientByDocumentAndBirthDateInput,
  ): Promise<ValidatePatientByDocumentAndBirthDateResult> {
    const patientRecord =
      await this.patientValidationRepository.findByDocumentAndBirthDate(
        input.documentNumber,
        input.birthDateIso,
      );

    if (!patientRecord) {
      return { isValid: false, reason: 'NOT_FOUND_OR_MISMATCH' };
    }

    const patientStatus = (patientRecord.status ?? '').trim().toUpperCase();
    if (patientStatus !== 'ACTIVO') {
      return { isValid: false, reason: 'INACTIVE_PATIENT' };
    }

    const epsCode = (patientRecord.epsCode ?? '').trim().toUpperCase();
    if (!epsCode) {
      return { isValid: false, reason: 'EPS_NOT_ALLOWED' };
    }

    const userType = (patientRecord.userType ?? '').trim().toUpperCase();
    const sex = (patientRecord.sex ?? '').trim().toUpperCase();
    if (!userType || (sex !== 'H' && sex !== 'M')) {
      return { isValid: false, reason: 'NOT_FOUND_OR_MISMATCH' };
    }

    const isAllowedEps =
      await this.contractedEpsRepository.isCodeAllowed(epsCode);
    if (!isAllowedEps) {
      return { isValid: false, reason: 'EPS_NOT_ALLOWED' };
    }

    return {
      isValid: true,
      patientId: patientRecord.patientId,
      epsCode,
      userType,
      sex,
    };
  }
}
