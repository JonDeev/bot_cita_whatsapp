import { Inject, Injectable } from '@nestjs/common';
import { PatientContactInputValidatorService } from '../services/patient-contact-input-validator.service';
import {
  MARK_PATIENT_PHONE_VERIFIED_REPOSITORY,
  PATIENT_CONTACT_PROFILE_REPOSITORY,
} from '../../domain/patients.tokens';
import type { PatientContactProfileRepository } from '../../domain/ports/patient-contact-profile.repository';
import type { MarkPatientPhoneVerifiedRepository } from '../../domain/ports/mark-patient-phone-verified.repository';

export interface MarkPatientPhoneVerifiedInput {
  patientId?: number | null;
  phone?: string | null;
  verifiedAtIso?: string;
  updatedBy: string;
  triggerFlowIntent: string;
}

export type MarkPatientPhoneVerifiedResult =
  | {
      status: 'UPDATED';
      phoneMasked: string;
    }
  | {
      status: 'VALIDATION_ERROR';
      reason:
        | 'INVALID_INPUT'
        | 'MISSING_PHONE'
        | 'INVALID_PHONE'
        | 'PHONE_MISMATCH';
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
export class MarkPatientPhoneVerifiedUseCase {
  constructor(
    @Inject(PATIENT_CONTACT_PROFILE_REPOSITORY)
    private readonly patientContactProfileRepository: PatientContactProfileRepository,
    @Inject(MARK_PATIENT_PHONE_VERIFIED_REPOSITORY)
    private readonly markPatientPhoneVerifiedRepository: MarkPatientPhoneVerifiedRepository,
    private readonly patientContactInputValidator: PatientContactInputValidatorService,
  ) {}

  async execute(
    input: MarkPatientPhoneVerifiedInput,
  ): Promise<MarkPatientPhoneVerifiedResult> {
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

    const normalizedPhone = this.patientContactInputValidator.normalizePhone(
      input.phone,
    );
    if (!normalizedPhone) {
      return {
        status: 'VALIDATION_ERROR',
        reason: 'MISSING_PHONE',
      };
    }

    if (
      !this.patientContactInputValidator.isValidColombianMobilePhone(
        normalizedPhone,
      )
    ) {
      return {
        status: 'VALIDATION_ERROR',
        reason: 'INVALID_PHONE',
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

      const currentPhone = this.patientContactInputValidator.normalizePhone(
        profile.primaryPhone,
      );
      if (currentPhone !== normalizedPhone) {
        return {
          status: 'VALIDATION_ERROR',
          reason: 'PHONE_MISMATCH',
        };
      }

      const persistenceResult =
        await this.markPatientPhoneVerifiedRepository.markPatientPhoneVerified({
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

      return {
        status: 'UPDATED',
        phoneMasked:
          this.patientContactInputValidator.maskPhone(normalizedPhone),
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
