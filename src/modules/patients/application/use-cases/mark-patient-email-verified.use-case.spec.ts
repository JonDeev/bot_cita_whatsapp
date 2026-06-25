import type { MarkPatientEmailVerifiedRepository } from '../../domain/ports/mark-patient-email-verified.repository';
import type { PatientContactProfileRepository } from '../../domain/ports/patient-contact-profile.repository';
import { PatientContactInputValidatorService } from '../services/patient-contact-input-validator.service';
import { MarkPatientEmailVerifiedUseCase } from './mark-patient-email-verified.use-case';

describe('MarkPatientEmailVerifiedUseCase', () => {
  function buildUseCase(overrides?: {
    patientContactProfileRepository?: PatientContactProfileRepository;
    markPatientEmailVerifiedRepository?: MarkPatientEmailVerifiedRepository;
    patientContactInputValidator?: PatientContactInputValidatorService;
  }): MarkPatientEmailVerifiedUseCase {
    return new MarkPatientEmailVerifiedUseCase(
      overrides?.patientContactProfileRepository ??
        ({
          findByPatientId: jest.fn().mockResolvedValue({
            patientId: 10,
            firstName: 'Daniel',
            secondName: null,
            firstLastName: 'Castano',
            secondLastName: null,
            primaryPhone: '3001234567',
            primaryEmail: 'daniel@example.com',
            phoneVerifiedAtIso: null,
            emailVerifiedAtIso: null,
          }),
        } as PatientContactProfileRepository),
      overrides?.markPatientEmailVerifiedRepository ??
        ({
          markPatientEmailVerified: jest.fn().mockResolvedValue('UPDATED'),
        } as MarkPatientEmailVerifiedRepository),
      overrides?.patientContactInputValidator ??
        new PatientContactInputValidatorService(),
    );
  }

  it('returns a masked email for a validated current email', async () => {
    const useCase = buildUseCase();

    const result = await useCase.execute({
      patientId: 10,
      email: '  Daniel@Example.com ',
      updatedBy: 'AdrianaBot',
      triggerFlowIntent: 'UPDATE_CONTACT',
    });

    expect(result).toEqual({
      status: 'UPDATED',
      emailMasked: 'd***@example.com',
    });
  });

  it('returns EMAIL_MISMATCH when the email does not match the current profile', async () => {
    const useCase = buildUseCase();

    const result = await useCase.execute({
      patientId: 10,
      email: 'nuevo@example.com',
      updatedBy: 'AdrianaBot',
      triggerFlowIntent: 'UPDATE_CONTACT',
    });

    expect(result).toEqual({
      status: 'VALIDATION_ERROR',
      reason: 'EMAIL_MISMATCH',
    });
  });

  it('returns a technical failure if masking ever fails after validation', async () => {
    const validator = {
      normalizeEmail: jest.fn().mockReturnValue('daniel@example.com'),
      isValidEmail: jest.fn().mockReturnValue(true),
      maskEmail: jest.fn().mockReturnValue(null),
    } as unknown as PatientContactInputValidatorService;
    const useCase = buildUseCase({
      patientContactInputValidator: validator,
    });

    const result = await useCase.execute({
      patientId: 10,
      email: 'daniel@example.com',
      updatedBy: 'AdrianaBot',
      triggerFlowIntent: 'UPDATE_CONTACT',
    });

    expect(result).toEqual({
      status: 'TECHNICAL_FAILURE',
      reason: 'UNEXPECTED_ERROR',
      technicalDetail: 'Unable to mask a validated email address',
    });
  });
});
