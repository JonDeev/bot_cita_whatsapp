import { ValidatePatientByDocumentAndBirthDateUseCase } from './validate-patient-by-document-and-birth-date.use-case';

describe('ValidatePatientByDocumentAndBirthDateUseCase', () => {
  it('returns valid only for active patients with allowed eps', async () => {
    const patientValidationRepository = {
      findByDocumentAndBirthDate: jest.fn().mockResolvedValue({
        patientId: 10,
        documentNumber: '12345678',
        birthDateIso: '1990-11-05',
        status: 'ACTIVO',
        epsCode: 'EPS042',
        userType: '01',
        sex: 'M',
      }),
    };
    const contractedEpsRepository = {
      isCodeAllowed: jest.fn().mockResolvedValue(true),
    };

    const useCase = new ValidatePatientByDocumentAndBirthDateUseCase(
      patientValidationRepository as any,
      contractedEpsRepository as any,
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
      sex: 'M',
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
        sex: 'M',
      }),
    };
    const contractedEpsRepository = {
      isCodeAllowed: jest.fn(),
    };

    const useCase = new ValidatePatientByDocumentAndBirthDateUseCase(
      patientValidationRepository as any,
      contractedEpsRepository as any,
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
});
