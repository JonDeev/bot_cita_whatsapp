import { Inject, Injectable } from '@nestjs/common';
import { PatientContactInputValidatorService } from '../services/patient-contact-input-validator.service';
import {
  PATIENT_CONTACT_PROFILE_REPOSITORY,
  UPDATE_PATIENT_CONTACT_DETAILS_REPOSITORY,
} from '../../domain/patients.tokens';
import type { PatientContactProfileRepository } from '../../domain/ports/patient-contact-profile.repository';
import type {
  PatientContactUpdateMode,
  UpdatePatientContactDetailsRepository,
} from '../../domain/ports/update-patient-contact-details.repository';

export interface UpdatePatientContactDetailsInput {
  patientId?: number | null;
  mode: PatientContactUpdateMode;
  newPhone?: string;
  newEmail?: string;
  updatedBy: string;
  triggerFlowIntent: string;
}

export type UpdatePatientContactDetailsResult =
  | {
      status: 'UPDATED';
      mode: PatientContactUpdateMode;
      phoneMasked: string | null;
      emailMasked: string | null;
    }
  | {
      status: 'VALIDATION_ERROR';
      reason:
        | 'INVALID_INPUT'
        | 'MISSING_PHONE'
        | 'MISSING_EMAIL'
        | 'INVALID_PHONE'
        | 'INVALID_EMAIL'
        | 'SAME_PHONE'
        | 'SAME_EMAIL';
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
export class UpdatePatientContactDetailsUseCase {
  constructor(
    @Inject(PATIENT_CONTACT_PROFILE_REPOSITORY)
    private readonly patientContactProfileRepository: PatientContactProfileRepository,
    @Inject(UPDATE_PATIENT_CONTACT_DETAILS_REPOSITORY)
    private readonly updatePatientContactDetailsRepository: UpdatePatientContactDetailsRepository,
    private readonly patientContactInputValidator: PatientContactInputValidatorService,
  ) {}

  async execute(
    input: UpdatePatientContactDetailsInput,
  ): Promise<UpdatePatientContactDetailsResult> {
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
      const currentEmail = this.patientContactInputValidator.normalizeEmail(
        profile.primaryEmail,
      );

      const phoneValidation = this.validateNewPhone({
        mode: input.mode,
        currentPhone,
        newPhone: input.newPhone,
      });
      if (phoneValidation) {
        return phoneValidation;
      }

      const emailValidation = this.validateNewEmail({
        mode: input.mode,
        currentEmail,
        newEmail: input.newEmail,
      });
      if (emailValidation) {
        return emailValidation;
      }

      const nextPrimaryPhone =
        input.mode === 'PHONE' || input.mode === 'BOTH'
          ? (this.patientContactInputValidator.normalizePhone(input.newPhone) ??
            undefined)
          : undefined;
      const nextPrimaryEmail =
        input.mode === 'EMAIL' || input.mode === 'BOTH'
          ? (this.patientContactInputValidator.normalizeEmail(input.newEmail) ??
            undefined)
          : undefined;

      const phoneBackupToSecondary =
        nextPrimaryPhone &&
        this.patientContactInputValidator.isValidColombianMobilePhone(
          currentPhone,
        ) &&
        currentPhone &&
        currentPhone !== nextPrimaryPhone
          ? currentPhone
          : undefined;
      const emailBackupToSecondary =
        nextPrimaryEmail &&
        this.patientContactInputValidator.isValidEmail(currentEmail) &&
        currentEmail &&
        currentEmail !== nextPrimaryEmail
          ? currentEmail
          : undefined;

      const persistenceResult =
        await this.updatePatientContactDetailsRepository.updatePatientContactDetails(
          {
            patientId,
            mode: input.mode,
            nextPrimaryPhone,
            phoneBackupToSecondary,
            nextPrimaryEmail,
            emailBackupToSecondary,
          },
        );

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
        mode: input.mode,
        phoneMasked:
          nextPrimaryPhone !== undefined
            ? this.patientContactInputValidator.maskPhone(nextPrimaryPhone)
            : null,
        emailMasked:
          nextPrimaryEmail !== undefined
            ? this.patientContactInputValidator.maskEmail(nextPrimaryEmail)
            : null,
      };
    } catch (error) {
      const technicalDetail = this.extractTechnicalDetail(error);
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

  private validateNewPhone(input: {
    mode: PatientContactUpdateMode;
    currentPhone: string | null;
    newPhone: string | undefined;
  }): Extract<
    UpdatePatientContactDetailsResult,
    { status: 'VALIDATION_ERROR' }
  > | null {
    if (input.mode === 'EMAIL') {
      return null;
    }

    const normalizedPhone = this.patientContactInputValidator.normalizePhone(
      input.newPhone,
    );
    if (!normalizedPhone) {
      return { status: 'VALIDATION_ERROR', reason: 'MISSING_PHONE' };
    }

    if (
      !this.patientContactInputValidator.isValidColombianMobilePhone(
        normalizedPhone,
      )
    ) {
      return { status: 'VALIDATION_ERROR', reason: 'INVALID_PHONE' };
    }

    if (input.currentPhone && normalizedPhone === input.currentPhone) {
      return { status: 'VALIDATION_ERROR', reason: 'SAME_PHONE' };
    }

    return null;
  }

  private validateNewEmail(input: {
    mode: PatientContactUpdateMode;
    currentEmail: string | null;
    newEmail: string | undefined;
  }): Extract<
    UpdatePatientContactDetailsResult,
    { status: 'VALIDATION_ERROR' }
  > | null {
    if (input.mode === 'PHONE') {
      return null;
    }

    const normalizedEmail = this.patientContactInputValidator.normalizeEmail(
      input.newEmail,
    );
    if (!normalizedEmail) {
      return { status: 'VALIDATION_ERROR', reason: 'MISSING_EMAIL' };
    }

    if (!this.patientContactInputValidator.isValidEmail(normalizedEmail)) {
      return { status: 'VALIDATION_ERROR', reason: 'INVALID_EMAIL' };
    }

    if (input.currentEmail && normalizedEmail === input.currentEmail) {
      return { status: 'VALIDATION_ERROR', reason: 'SAME_EMAIL' };
    }

    return null;
  }

  private extractTechnicalDetail(error: unknown): string | undefined {
    if (!(error instanceof Error)) {
      return undefined;
    }

    const normalizedMessage = error.message.trim();
    return normalizedMessage.length > 0 ? normalizedMessage : undefined;
  }
}
