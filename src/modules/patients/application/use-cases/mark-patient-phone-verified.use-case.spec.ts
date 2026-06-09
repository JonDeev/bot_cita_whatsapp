import type { MarkPatientPhoneVerifiedRepository } from '../../domain/ports/mark-patient-phone-verified.repository';
import type { PatientContactProfileRepository } from '../../domain/ports/patient-contact-profile.repository';
import { PatientContactInputValidatorService } from '../services/patient-contact-input-validator.service';
import { MarkPatientPhoneVerifiedUseCase } from './mark-patient-phone-verified.use-case';

describe('MarkPatientPhoneVerifiedUseCase', () => {
  function buildUseCase(overrides?: {
    patientContactProfileRepository?: PatientContactProfileRepository;
    markPatientPhoneVerifiedRepository?: MarkPatientPhoneVerifiedRepository;
    patientContactInputValidator?: PatientContactInputValidatorService;
  }): MarkPatientPhoneVerifiedUseCase {
    return new MarkPatientPhoneVerifiedUseCase(
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
      overrides?.markPatientPhoneVerifiedRepository ??
        ({
          markPatientPhoneVerified: jest.fn().mockResolvedValue('UPDATED'),
        } as MarkPatientPhoneVerifiedRepository),
      overrides?.patientContactInputValidator ??
        new PatientContactInputValidatorService(),
    );
  }

  it('returns a non-null masked phone for a validated phone', async () => {
    const useCase = buildUseCase();

    const result = await useCase.execute({
      patientId: 10,
      phone: '3001234567',
      updatedBy: 'AdrianaBot',
      triggerFlowIntent: 'UPDATE_CONTACT',
    });

    expect(result).toEqual({
      status: 'UPDATED',
      phoneMasked: '******67',
    });
  });

  it('returns a technical failure if masking ever fails after validation', async () => {
    const validator = {
      normalizePhone: jest.fn().mockReturnValue('3001234567'),
      isValidColombianMobilePhone: jest.fn().mockReturnValue(true),
      maskPhone: jest.fn().mockReturnValue(null),
    } as unknown as PatientContactInputValidatorService;
    const useCase = buildUseCase({
      patientContactInputValidator: validator,
    });

    const result = await useCase.execute({
      patientId: 10,
      phone: '3001234567',
      updatedBy: 'AdrianaBot',
      triggerFlowIntent: 'UPDATE_CONTACT',
    });

    expect(result).toEqual({
      status: 'TECHNICAL_FAILURE',
      reason: 'UNEXPECTED_ERROR',
      technicalDetail: 'Unable to mask a validated phone number',
    });
  });
});
