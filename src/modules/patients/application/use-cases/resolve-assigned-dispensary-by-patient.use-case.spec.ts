import type { PatientAssignedDispensaryRepository } from '../../domain/ports/patient-assigned-dispensary.repository';
import { ResolveAssignedDispensaryByPatientUseCase } from './resolve-assigned-dispensary-by-patient.use-case';

describe('ResolveAssignedDispensaryByPatientUseCase', () => {
  it('returns FOUND when patient has an assigned dispensary', async () => {
    const findAssignedDispensaryByPatientId = jest.fn().mockResolvedValue({
      patientId: 10,
      firstName: 'DANIEL',
      secondName: null,
      firstLastName: 'CASTANO',
      secondLastName: null,
      dispensaryId: 4,
      dispensaryName: 'DISPENSARIO SUPLYMEDICAL',
      dispensaryAddress: "CLL 29 CRA 13 FRENTE A MCDONALD'S",
      dispensaryCity: 'SANTA MARTA',
      dispensarySchedule: 'Lunes a viernes 8:00 - 12:00 y 2:00 a 6:00',
    });
    const findPatientFullNameById = jest.fn();

    const repository: PatientAssignedDispensaryRepository = {
      findAssignedDispensaryByPatientId,
      findPatientFullNameById,
    };
    const useCase = new ResolveAssignedDispensaryByPatientUseCase(repository);

    const result = await useCase.execute({ patientId: 10 });

    expect(result).toEqual({
      status: 'FOUND',
      patientFullName: 'DANIEL CASTANO',
      dispensary: {
        id: 4,
        name: 'DISPENSARIO SUPLYMEDICAL',
        address: "CLL 29 CRA 13 FRENTE A MCDONALD'S",
        city: 'SANTA MARTA',
        schedule: 'Lunes a viernes 8:00 - 12:00 y 2:00 a 6:00',
      },
    });
    expect(findPatientFullNameById).not.toHaveBeenCalled();
  });

  it('returns NOT_ASSIGNED when patient exists but has no dispensary assignment', async () => {
    const repository: PatientAssignedDispensaryRepository = {
      findAssignedDispensaryByPatientId: jest.fn().mockResolvedValue(null),
      findPatientFullNameById: jest.fn().mockResolvedValue('DANIEL CASTANO'),
    };
    const useCase = new ResolveAssignedDispensaryByPatientUseCase(repository);

    const result = await useCase.execute({ patientId: 10 });

    expect(result).toEqual({
      status: 'NOT_ASSIGNED',
      patientFullName: 'DANIEL CASTANO',
    });
  });

  it('returns TECHNICAL_FAILURE when patientId is invalid', async () => {
    const repository: PatientAssignedDispensaryRepository = {
      findAssignedDispensaryByPatientId: jest.fn(),
      findPatientFullNameById: jest.fn(),
    };
    const useCase = new ResolveAssignedDispensaryByPatientUseCase(repository);

    const result = await useCase.execute({ patientId: 0 });

    expect(result).toEqual({
      status: 'TECHNICAL_FAILURE',
      reason: 'INVALID_INPUT',
    });
  });
});
