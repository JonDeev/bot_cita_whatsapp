import { Inject, Injectable } from '@nestjs/common';
import { PatientContactInputValidatorService } from '../services/patient-contact-input-validator.service';
import {
  MARK_PATIENT_EMAIL_VERIFIED_REPOSITORY,
  PATIENT_CONTACT_PROFILE_REPOSITORY,
} from '../../domain/patients.tokens';
import type { PatientContactProfileRepository } from '../../domain/ports/patient-contact-profile.repository';
import type { MarkPatientEmailVerifiedRepository } from '../../domain/ports/mark-patient-email-verified.repository';

export interface MarkPatientEmailVerifiedInput {
  patientId?: number | null;
  email?: string | null;
  verifiedAtIso?: string;
  updatedBy: string;
  triggerFlowIntent: string;
}

export type MarkPatientEmailVerifiedResult =
  | {
      status: 'UPDATED';
      emailMasked: string;
    }
  | {
      status: 'VALIDATION_ERROR';
      reason:
        | 'INVALID_INPUT'
        | 'MISSING_EMAIL'
        | 'INVALID_EMAIL'
        | 'EMAIL_MISMATCH';
    }
  | {
      status: 'TECHNICAL_FAILURE';
      reason:
        | 'PATIENT_NOT_FOUND'
        | 'WRITE_DISABLED'
        | 'MISSING_WRITE_CONFIGURATION'
        | 'UNEXPECTED_ERROR';
      technicalDetail?: string;
    };

@Injectable()
export class MarkPatientEmailVerifiedUseCase {
  constructor(
    @Inject(PATIENT_CONTACT_PROFILE_REPOSITORY)
    private readonly patientContactProfileRepository: PatientContactProfileRepository,
    @Inject(MARK_PATIENT_EMAIL_VERIFIED_REPOSITORY)
    private readonly markPatientEmailVerifiedRepository: MarkPatientEmailVerifiedRepository,
    private readonly patientContactInputValidator: PatientContactInputValidatorService,
  ) {}

  async execute(
    input: MarkPatientEmailVerifiedInput,
  ): Promise<MarkPatientEmailVerifiedResult> {
    void input.updatedBy;
    void input.triggerFlowIntent;

    const patientId = input.patientId ?? null;
    if (
      typeof patientId !== 'number' ||
      !Number.isInteger(patientId) ||
      patientId <= 0
    ) {
      return {
        status: 'VALIDATION_ERROR',
        reason: 'INVALID_INPUT',
      };
    }

    const normalizedEmail = this.patientContactInputValidator.normalizeEmail(
      input.email,
    );
    if (!normalizedEmail) {
      return {
        status: 'VALIDATION_ERROR',
        reason: 'MISSING_EMAIL',
      };
    }

    if (!this.patientContactInputValidator.isValidEmail(normalizedEmail)) {
      return {
        status: 'VALIDATION_ERROR',
        reason: 'INVALID_EMAIL',
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

      const currentEmail = this.patientContactInputValidator.normalizeEmail(
        profile.primaryEmail,
      );
      if (currentEmail !== normalizedEmail) {
        return {
          status: 'VALIDATION_ERROR',
          reason: 'EMAIL_MISMATCH',
        };
      }

      const persistenceResult =
        await this.markPatientEmailVerifiedRepository.markPatientEmailVerified({
          patientId,
          verifiedAtIso: input.verifiedAtIso,
        });

      if (persistenceResult === 'PATIENT_NOT_FOUND') {
        return {
          status: 'TECHNICAL_FAILURE',
          reason: 'PATIENT_NOT_FOUND',
        };
      }

      if (persistenceResult === 'WRITE_DISABLED') {
        return {
          status: 'TECHNICAL_FAILURE',
          reason: 'WRITE_DISABLED',
        };
      }

      const maskedEmail =
        this.patientContactInputValidator.maskEmail(normalizedEmail);
      if (!maskedEmail) {
        return {
          status: 'TECHNICAL_FAILURE',
          reason: 'UNEXPECTED_ERROR',
          technicalDetail: 'Unable to mask a validated email address',
        };
      }

      return {
        status: 'UPDATED',
        emailMasked: maskedEmail,
      };
    } catch (error) {
      const technicalDetail =
        error instanceof Error ? error.message : 'Unknown error';
      if (
        error instanceof Error &&
        error.message.includes('MISSING_WRITE_CONFIGURATION')
      ) {
        return {
          status: 'TECHNICAL_FAILURE',
          reason: 'MISSING_WRITE_CONFIGURATION',
          technicalDetail,
        };
      }

      return {
        status: 'TECHNICAL_FAILURE',
        reason: 'UNEXPECTED_ERROR',
        technicalDetail,
      };
    }
  }
}
