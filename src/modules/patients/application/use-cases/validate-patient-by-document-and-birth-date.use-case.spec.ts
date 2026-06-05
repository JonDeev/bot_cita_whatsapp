import { PatientIdentityInputNormalizerService } from '../services/patient-identity-input-normalizer.service';
import { ValidatePatientByDocumentAndBirthDateUseCase } from './validate-patient-by-document-and-birth-date.use-case';

describe('ValidatePatientByDocumentAndBirthDateUseCase', () => {
  function buildInputNormalizer() {
    return {
      normalizePatientSexCode: jest.fn().mockImplementation((value) => {
        const normalized = String(value ?? '').trim().toUpperCase();
        return normalized === 'F' || normalized === 'M' || normalized === 'I'
          ? normalized
          : null;
      }),
    } as unknown as PatientIdentityInputNormalizerService;
  }

  it('returns valid only for active patients with allowed eps', async () => {
    const patientValidationRepository = {
      findByDocumentAndBirthDate: jest.fn().mockResolvedValue({
        patientId: 10,
        documentNumber: '12345678',
        birthDateIso: '1990-11-05',
        status: 'ACTIVO',
        epsCode: 'EPS042',
        userType: '01',
        sex: 'F',
      }),
    };
    const contractedEpsRepository = {
      isCodeAllowed: jest.fn().mockResolvedValue(true),
    };

    const useCase = new ValidatePatientByDocumentAndBirthDateUseCase(
      patientValidationRepository,
      contractedEpsRepository,
      buildInputNormalizer(),
    );

    const result = await useCase.execute({
      documentNumber: '12345678',
      birthDateIso: '1990-11-05',
    });

    expect(result).toEqual({
      isValid: true,
      patientId: 10,
      epsCode: 'EPS042',
      userType: '01',
      sex: 'F',
    });
  });

  it('fails when patient is inactive or eps is not allowed', async () => {
    const patientValidationRepository = {
      findByDocumentAndBirthDate: jest.fn().mockResolvedValue({
        patientId: 10,
        documentNumber: '12345678',
        birthDateIso: '1990-11-05',
        status: 'INACTIVO',
        epsCode: 'EPS042',
        userType: '01',
        sex: 'F',
      }),
    };
    const contractedEpsRepository = {
      isCodeAllowed: jest.fn(),
    };

    const useCase = new ValidatePatientByDocumentAndBirthDateUseCase(
      patientValidationRepository,
      contractedEpsRepository,
      buildInputNormalizer(),
    );

    const result = await useCase.execute({
      documentNumber: '12345678',
      birthDateIso: '1990-11-05',
    });

    expect(result).toEqual({
      isValid: false,
      reason: 'INACTIVE_PATIENT',
    });
  });

  it('rejects legacy H values', async () => {
    const patientValidationRepository = {
      findByDocumentAndBirthDate: jest.fn().mockResolvedValue({
        patientId: 10,
        documentNumber: '12345678',
        birthDateIso: '1990-11-05',
        status: 'ACTIVO',
        epsCode: 'EPS042',
        userType: '01',
        sex: 'H',
      }),
    };
    const contractedEpsRepository = {
      isCodeAllowed: jest.fn().mockResolvedValue(true),
    };

    const useCase = new ValidatePatientByDocumentAndBirthDateUseCase(
      patientValidationRepository,
      contractedEpsRepository,
      buildInputNormalizer(),
    );

    const result = await useCase.execute({
      documentNumber: '12345678',
      birthDateIso: '1990-11-05',
    });

    expect(result).toEqual({
      isValid: false,
      reason: 'NOT_FOUND_OR_MISMATCH',
    });
  });
});
