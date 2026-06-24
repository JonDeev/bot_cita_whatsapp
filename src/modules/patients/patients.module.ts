import { Module } from '@nestjs/common';
import { PrismaBotModule } from '../../shared/infrastructure/prisma-bot/prisma-bot.module';
import { PrismaModule } from '../../shared/infrastructure/prisma/prisma.module';
import { PatientIdentityInputNormalizerService } from './application/services/patient-identity-input-normalizer.service';
import { PatientContactInputValidatorService } from './application/services/patient-contact-input-validator.service';
import { ResolveAssignedDispensaryByPatientUseCase } from './application/use-cases/resolve-assigned-dispensary-by-patient.use-case';
import { ResolveEligibleSpecialtiesByPatientUseCase } from './application/use-cases/resolve-eligible-specialties-by-patient.use-case';
import { ResolvePostBookingWhatsappAppointmentNotificationsOptInGateUseCase } from './application/use-cases/resolve-post-booking-whatsapp-appointment-notifications-opt-in-gate.use-case';
import { ResolvePatientContactProfileUseCase } from './application/use-cases/resolve-patient-contact-profile.use-case';
import { ResolveWhatsappAppointmentNotificationsOptInGateUseCase } from './application/use-cases/resolve-whatsapp-appointment-notifications-opt-in-gate.use-case';
import { RegisterWhatsappPostBookingConsentUseCase } from './application/use-cases/register-whatsapp-post-booking-consent.use-case';
import { MarkPatientPhoneVerifiedUseCase } from './application/use-cases/mark-patient-phone-verified.use-case';
import { UpdatePatientContactDetailsUseCase } from './application/use-cases/update-patient-contact-details.use-case';
import { ValidatePatientByDocumentAndBirthDateUseCase } from './application/use-cases/validate-patient-by-document-and-birth-date.use-case';
import {
  CONTRACTED_EPS_REPOSITORY,
  MARK_PATIENT_PHONE_VERIFIED_REPOSITORY,
  PATIENT_CONTACT_PROFILE_REPOSITORY,
  PATIENT_ASSIGNED_DISPENSARY_REPOSITORY,
  PATIENT_SPECIALTY_ELIGIBILITY_REPOSITORY,
  PATIENT_VALIDATION_REPOSITORY,
  UPDATE_PATIENT_CONTACT_DETAILS_REPOSITORY,
  WHATSAPP_CONTACT_CONSENT_REPOSITORY,
  WHATSAPP_CONTACT_CONSENT_READER_REPOSITORY,
} from './domain/patients.tokens';
import { MariadbLegacyPatientContactDetailsRepository } from './infrastructure/persistence/mysql/mariadb-legacy-patient-contact-details.repository';
import { PrismaBotContractedEpsRepository } from './infrastructure/persistence/mysql/prisma-bot-contracted-eps.repository';
import { PrismaBotWhatsappContactConsentRepository } from './infrastructure/persistence/mysql/prisma-bot-whatsapp-contact-consent.repository';
import { PrismaLegacyPatientAssignedDispensaryRepository } from './infrastructure/persistence/mysql/prisma-legacy-patient-assigned-dispensary.repository';
import { PrismaLegacyPatientContactProfileRepository } from './infrastructure/persistence/mysql/prisma-legacy-patient-contact-profile.repository';
import { PrismaPatientSpecialtyEligibilityRepository } from './infrastructure/persistence/mysql/prisma-patient-specialty-eligibility.repository';
import { PrismaLegacyPatientValidationRepository } from './infrastructure/persistence/mysql/prisma-legacy-patient-validation.repository';

@Module({
  imports: [PrismaModule, PrismaBotModule],
  providers: [
    PatientIdentityInputNormalizerService,
    PatientContactInputValidatorService,
    ValidatePatientByDocumentAndBirthDateUseCase,
    ResolveAssignedDispensaryByPatientUseCase,
    ResolveEligibleSpecialtiesByPatientUseCase,
    ResolvePostBookingWhatsappAppointmentNotificationsOptInGateUseCase,
    ResolvePatientContactProfileUseCase,
    ResolveWhatsappAppointmentNotificationsOptInGateUseCase,
    RegisterWhatsappPostBookingConsentUseCase,
    MarkPatientPhoneVerifiedUseCase,
    UpdatePatientContactDetailsUseCase,
    MariadbLegacyPatientContactDetailsRepository,
    PrismaBotWhatsappContactConsentRepository,
    {
      provide: PATIENT_VALIDATION_REPOSITORY,
      useClass: PrismaLegacyPatientValidationRepository,
    },
    {
      provide: CONTRACTED_EPS_REPOSITORY,
      useClass: PrismaBotContractedEpsRepository,
    },
    {
      provide: PATIENT_SPECIALTY_ELIGIBILITY_REPOSITORY,
      useClass: PrismaPatientSpecialtyEligibilityRepository,
    },
    {
      provide: PATIENT_ASSIGNED_DISPENSARY_REPOSITORY,
      useClass: PrismaLegacyPatientAssignedDispensaryRepository,
    },
    {
      provide: WHATSAPP_CONTACT_CONSENT_REPOSITORY,
      useExisting: PrismaBotWhatsappContactConsentRepository,
    },
    {
      provide: WHATSAPP_CONTACT_CONSENT_READER_REPOSITORY,
      useExisting: PrismaBotWhatsappContactConsentRepository,
    },
    {
      provide: PATIENT_CONTACT_PROFILE_REPOSITORY,
      useClass: PrismaLegacyPatientContactProfileRepository,
    },
    {
      provide: UPDATE_PATIENT_CONTACT_DETAILS_REPOSITORY,
      useExisting: MariadbLegacyPatientContactDetailsRepository,
    },
    {
      provide: MARK_PATIENT_PHONE_VERIFIED_REPOSITORY,
      useExisting: MariadbLegacyPatientContactDetailsRepository,
    },
  ],
  exports: [
    PatientIdentityInputNormalizerService,
    PatientContactInputValidatorService,
    ValidatePatientByDocumentAndBirthDateUseCase,
    ResolveAssignedDispensaryByPatientUseCase,
    ResolveEligibleSpecialtiesByPatientUseCase,
    ResolvePostBookingWhatsappAppointmentNotificationsOptInGateUseCase,
    ResolvePatientContactProfileUseCase,
    ResolveWhatsappAppointmentNotificationsOptInGateUseCase,
    RegisterWhatsappPostBookingConsentUseCase,
    MarkPatientPhoneVerifiedUseCase,
    UpdatePatientContactDetailsUseCase,
    WHATSAPP_CONTACT_CONSENT_REPOSITORY,
    WHATSAPP_CONTACT_CONSENT_READER_REPOSITORY,
  ],
})
export class PatientsModule {}
