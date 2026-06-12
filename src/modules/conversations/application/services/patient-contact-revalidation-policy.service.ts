import { Injectable } from '@nestjs/common';
import { PatientContactInputValidatorService } from '../../../patients/application/services/patient-contact-input-validator.service';
import type { ContactPhoneRevalidationReason } from '../../domain/entities/conversation-session-context.entity';

export interface PatientContactRevalidationPolicyInput {
  primaryPhone: string | null;
  phoneVerifiedAtIso: string | null;
  participantPhone: string | null | undefined;
}

export interface PatientContactRevalidationPolicyResult {
  requiresPhoneRevalidation: boolean;
  reasons: ContactPhoneRevalidationReason[];
}

@Injectable()
export class PatientContactRevalidationPolicyService {
  constructor(
    private readonly patientContactInputValidator: PatientContactInputValidatorService,
  ) {}

  evaluate(
    input: PatientContactRevalidationPolicyInput,
  ): PatientContactRevalidationPolicyResult {
    const normalizedPrimaryPhone = this.patientContactInputValidator.normalizePhone(
      input.primaryPhone,
    );
    if (!normalizedPrimaryPhone) {
      return this.buildResult(['MISSING_PHONE']);
    }

    if (
      !this.patientContactInputValidator.isValidColombianMobilePhone(
        normalizedPrimaryPhone,
      )
    ) {
      return this.buildResult(['INVALID_PHONE']);
    }

    const reasons: ContactPhoneRevalidationReason[] = [];

    if (!this.isVerifiedAtUsable(input.phoneVerifiedAtIso)) {
      reasons.push('PHONE_NOT_VERIFIED');
    }

    if (
      !this.patientContactInputValidator.isSamePhoneNumber(
        normalizedPrimaryPhone,
        input.participantPhone,
      )
    ) {
      reasons.push('SESSION_PHONE_MISMATCH');
    }

    return this.buildResult(reasons);
  }

  private isVerifiedAtUsable(value: string | null | undefined): boolean {
    if (!value) {
      return false;
    }

    const verifiedAt = new Date(value);
    return !Number.isNaN(verifiedAt.getTime());
  }

  private buildResult(
    reasons: ContactPhoneRevalidationReason[],
  ): PatientContactRevalidationPolicyResult {
    return {
      requiresPhoneRevalidation: reasons.length > 0,
      reasons,
    };
  }
}
