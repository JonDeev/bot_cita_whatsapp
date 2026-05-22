import { Inject, Injectable } from '@nestjs/common';
import { PatientContactInputValidatorService } from '../services/patient-contact-input-validator.service';
import { PATIENT_CONTACT_PROFILE_REPOSITORY } from '../../domain/patients.tokens';
import type { PatientContactProfileRepository } from '../../domain/ports/patient-contact-profile.repository';

export interface ResolvePatientContactProfileInput {
  patientId?: number | null;
}

export type ResolvePatientContactProfileResult =
  | {
      status: 'FOUND';
      patientId: number;
      fullName: string;
      primaryPhone: string | null;
      primaryEmail: string | null;
      isPrimaryPhoneValid: boolean;
      isPrimaryEmailValid: boolean;
    }
  | {
      status: 'TECHNICAL_FAILURE';
      reason: 'INVALID_INPUT' | 'PATIENT_NOT_FOUND' | 'UNEXPECTED_ERROR';
    };

@Injectable()
export class ResolvePatientContactProfileUseCase {
  constructor(
    @Inject(PATIENT_CONTACT_PROFILE_REPOSITORY)
    private readonly patientContactProfileRepository: PatientContactProfileRepository,
    private readonly patientContactInputValidator: PatientContactInputValidatorService,
  ) {}

  async execute(
    input: ResolvePatientContactProfileInput,
  ): Promise<ResolvePatientContactProfileResult> {
    const patientId = input.patientId ?? null;
    if (
      typeof patientId !== 'number' ||
      !Number.isInteger(patientId) ||
      patientId <= 0
    ) {
      return {
        status: 'TECHNICAL_FAILURE',
        reason: 'INVALID_INPUT',
      };
    }

    try {
      const profile =
        await this.patientContactProfileRepository.findByPatientId(patientId);
      if (!profile) {
        return {
          status: 'TECHNICAL_FAILURE',
          reason: 'PATIENT_NOT_FOUND',
        };
      }

      const fullName = [
        profile.firstName,
        profile.secondName,
        profile.firstLastName,
        profile.secondLastName,
      ]
        .map((part) => part?.trim() ?? '')
        .filter((part) => part.length > 0)
        .join(' ')
        .trim();

      const primaryPhone = this.patientContactInputValidator.normalizePhone(
        profile.primaryPhone,
      );
      const primaryEmail = this.patientContactInputValidator.normalizeEmail(
        profile.primaryEmail,
      );

      return {
        status: 'FOUND',
        patientId: profile.patientId,
        fullName: fullName || 'PACIENTE',
        primaryPhone,
        primaryEmail,
        isPrimaryPhoneValid:
          this.patientContactInputValidator.isValidColombianMobilePhone(
            primaryPhone,
          ),
        isPrimaryEmailValid:
          this.patientContactInputValidator.isValidEmail(primaryEmail),
      };
    } catch {
      return {
        status: 'TECHNICAL_FAILURE',
        reason: 'UNEXPECTED_ERROR',
      };
    }
  }
}
