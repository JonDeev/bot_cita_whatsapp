import { ResolveAvailableAppointmentDoctorsBySpecialtyUseCase } from './resolve-available-appointment-doctors-by-specialty.use-case';

describe('ResolveAvailableAppointmentDoctorsBySpecialtyUseCase', () => {
  it('returns unique doctors with display names', async () => {
    const repository = {
      findAvailableDoctors: jest.fn().mockResolvedValue([
        { employeeCode: 'M001', professionalName: 'ANA GARCIA' },
        { employeeCode: 'M001', professionalName: 'ANA GARCIA' },
        { employeeCode: 'M002', professionalName: ' ' },
      ]),
    };
    const cutoffService = {
      build: jest.fn().mockReturnValue({
        cutoffDateIso: '2026-05-05',
        cutoffTimeHHmm: '12:39',
      }),
    };

    const useCase = new ResolveAvailableAppointmentDoctorsBySpecialtyUseCase(
      repository as any,
      cutoffService as any,
    );

    const result = await useCase.execute({
      specialtyCups: '890201',
      now: new Date('2026-05-05T15:39:00.000Z'),
    });

    expect(repository.findAvailableDoctors).toHaveBeenCalledWith({
      specialtyCups: '890201',
      cutoffDateIso: '2026-05-05',
      cutoffTimeHHmm: '12:39',
      maxResults: 9,
    });
    expect(result).toEqual({
      hasAvailability: true,
      doctors: [
        { employeeCode: 'M001', displayName: 'ANA GARCIA' },
        { employeeCode: 'M002', displayName: 'MEDICO M002' },
      ],
    });
  });

  it('returns failure when specialty cups is missing', async () => {
    const useCase = new ResolveAvailableAppointmentDoctorsBySpecialtyUseCase(
      {
        findAvailableDoctors: jest.fn(),
      } as any,
      {
        build: jest.fn(),
      } as any,
    );

    const result = await useCase.execute({
      specialtyCups: '   ',
    });

    expect(result).toEqual({
      hasAvailability: false,
      reason: 'SPECIALTY_CUPS_MISSING',
      doctors: [],
    });
  });
});
