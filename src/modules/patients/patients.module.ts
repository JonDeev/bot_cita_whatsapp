import { Module } from '@nestjs/common';
import { PrismaBotModule } from '../../shared/infrastructure/prisma-bot/prisma-bot.module';
import { PrismaModule } from '../../shared/infrastructure/prisma/prisma.module';
import { PatientIdentityInputNormalizerService } from './application/services/patient-identity-input-normalizer.service';
import { ResolveEligibleSpecialtiesByPatientUseCase } from './application/use-cases/resolve-eligible-specialties-by-patient.use-case';
import { ValidatePatientByDocumentAndBirthDateUseCase } from './application/use-cases/validate-patient-by-document-and-birth-date.use-case';
import {
  CONTRACTED_EPS_REPOSITORY,
  PATIENT_SPECIALTY_ELIGIBILITY_REPOSITORY,
  PATIENT_VALIDATION_REPOSITORY,
} from './domain/patients.tokens';
import { PrismaBotContractedEpsRepository } from './infrastructure/persistence/mysql/prisma-bot-contracted-eps.repository';
import { PrismaPatientSpecialtyEligibilityRepository } from './infrastructure/persistence/mysql/prisma-patient-specialty-eligibility.repository';
import { PrismaLegacyPatientValidationRepository } from './infrastructure/persistence/mysql/prisma-legacy-patient-validation.repository';

@Module({
  imports: [PrismaModule, PrismaBotModule],
  providers: [
    PatientIdentityInputNormalizerService,
    ValidatePatientByDocumentAndBirthDateUseCase,
    ResolveEligibleSpecialtiesByPatientUseCase,
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
  ],
  exports: [
    PatientIdentityInputNormalizerService,
    ValidatePatientByDocumentAndBirthDateUseCase,
    ResolveEligibleSpecialtiesByPatientUseCase,
  ],
})
export class PatientsModule {}
