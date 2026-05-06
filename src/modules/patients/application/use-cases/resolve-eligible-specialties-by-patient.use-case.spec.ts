import { ResolveEligibleSpecialtiesByPatientUseCase } from './resolve-eligible-specialties-by-patient.use-case';

describe('ResolveEligibleSpecialtiesByPatientUseCase', () => {
  it('returns eligible specialties for allowed eps and valid profile', async () => {
    const contractedEpsRepository = {
      isCodeAllowed: jest.fn().mockResolvedValue(true),
    };
    const specialtyEligibilityRepository = {
      findEligibleSpecialties: jest.fn().mockResolvedValue([
        { code: '890201', name: 'MEDICINA GENERAL', cups: '890201' },
      ]),
    };

    const useCase = new ResolveEligibleSpecialtiesByPatientUseCase(
      contractedEpsRepository as any,
      specialtyEligibilityRepository as any,
    );

    const result = await useCase.execute({
      epsCode: 'eps042',
      userType: '01',
      sex: 'm',
    });

    expect(result).toEqual({
      isEligible: true,
      specialties: [{ code: '890201', name: 'MEDICINA GENERAL', cups: '890201' }],
    });
  });

  it('returns failure when no specialties are available', async () => {
    const contractedEpsRepository = {
      isCodeAllowed: jest.fn().mockResolvedValue(true),
    };
    const specialtyEligibilityRepository = {
      findEligibleSpecialties: jest.fn().mockResolvedValue([]),
    };

    const useCase = new ResolveEligibleSpecialtiesByPatientUseCase(
      contractedEpsRepository as any,
      specialtyEligibilityRepository as any,
    );

    const result = await useCase.execute({
      epsCode: 'EPS042',
      userType: '04',
      sex: 'H',
    });

    expect(result).toEqual({
      isEligible: false,
      reason: 'NO_SPECIALTIES_AVAILABLE',
    });
  });
});
