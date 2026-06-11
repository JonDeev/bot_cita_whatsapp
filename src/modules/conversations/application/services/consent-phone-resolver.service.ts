import { Injectable } from '@nestjs/common';
import { PatientContactInputValidatorService } from '../../../patients/application/services/patient-contact-input-validator.service';
import type { ConversationSession } from '../../domain/entities/conversation-session.entity';

export type ConsentPhoneResolutionResult =
  | {
      status: 'FOUND';
      phone: string;
    }
  | {
      status: 'NONE';
    };

@Injectable()
export class ConsentPhoneResolverService {
  constructor(
    private readonly patientContactInputValidator: PatientContactInputValidatorService,
  ) {}

  resolve(session: ConversationSession): ConsentPhoneResolutionResult {
    const phone = this.patientContactInputValidator.normalizePhone(
      session.context?.appointmentNotificationsConsentPhone,
    );

    if (!phone) {
      return { status: 'NONE' };
    }

    return {
      status: 'FOUND',
      phone,
    };
  }
}
