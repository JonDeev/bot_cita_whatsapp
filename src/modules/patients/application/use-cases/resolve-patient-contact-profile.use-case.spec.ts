import type { PatientContactProfileRepository } from '../../domain/ports/patient-contact-profile.repository';
import { PatientContactInputValidatorService } from '../services/patient-contact-input-validator.service';
import { ResolvePatientContactProfileUseCase } from './resolve-patient-contact-profile.use-case';

describe('ResolvePatientContactProfileUseCase', () => {
  it('returns normalized contact profile with validity flags', async () => {
    const repository: PatientContactProfileRepository = {
      findByPatientId: jest.fn().mockResolvedValue({
        patientId: 10,
        firstName: 'DANIEL',
        secondName: null,
        firstLastName: 'CASTANO',
        secondLastName: null,
        primaryPhone: '300-123-4567',
        primaryEmail: 'Daniel@Example.com',
        phoneVerifiedAtIso: null,
        emailVerifiedAtIso: null,
      }),
    };
    const useCase = new ResolvePatientContactProfileUseCase(
      repository,
      new PatientContactInputValidatorService(),
    );

    const result = await useCase.execute({ patientId: 10 });

    expect(result).toEqual({
      status: 'FOUND',
      patientId: 10,
      fullName: 'DANIEL CASTANO',
      primaryPhone: '3001234567',
      primaryEmail: 'daniel@example.com',
      phoneVerifiedAtIso: null,
      isPrimaryPhoneValid: true,
      isPrimaryEmailValid: true,
    });
  });

  it('returns technical failure when patientId is invalid', async () => {
    const useCase = new ResolvePatientContactProfileUseCase(
      {
        findByPatientId: jest.fn(),
      },
      new PatientContactInputValidatorService(),
    );

    const result = await useCase.execute({ patientId: 0 });

    expect(result).toEqual({
      status: 'TECHNICAL_FAILURE',
      reason: 'INVALID_INPUT',
    });
  });
});
