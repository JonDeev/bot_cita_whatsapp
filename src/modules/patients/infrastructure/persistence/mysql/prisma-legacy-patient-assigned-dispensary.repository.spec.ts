import { PrismaService } from '../../../../../shared/infrastructure/prisma/prisma.service';
import { PrismaLegacyPatientAssignedDispensaryRepository } from './prisma-legacy-patient-assigned-dispensary.repository';

describe('PrismaLegacyPatientAssignedDispensaryRepository', () => {
  it('returns assigned dispensary data when join resolves a record', async () => {
    const queryRaw = jest
      .fn()
      .mockResolvedValueOnce([
        {
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
        },
      ])
      .mockResolvedValueOnce([
        {
          firstName: 'DANIEL',
          secondName: null,
          firstLastName: 'CASTANO',
          secondLastName: null,
        },
      ]);

    const prisma = {
      $queryRaw: queryRaw,
    } as unknown as PrismaService;

    const repository = new PrismaLegacyPatientAssignedDispensaryRepository(
      prisma,
    );
    const assigned = await repository.findAssignedDispensaryByPatientId(10);
    const fullName = await repository.findPatientFullNameById(10);

    expect(assigned).toEqual({
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
    expect(fullName).toBe('DANIEL CASTANO');
    expect(queryRaw).toHaveBeenCalledTimes(2);
  });
});
