import { PrismaBotService } from '../../../../../shared/infrastructure/prisma-bot/prisma-bot.service';
import { PrismaService } from '../../../../../shared/infrastructure/prisma/prisma.service';
import { PrismaPatientSpecialtyEligibilityRepository } from './prisma-patient-specialty-eligibility.repository';

describe('PrismaPatientSpecialtyEligibilityRepository', () => {
  it('resolves specialties when bot rules use CUPS codes', async () => {
    const prisma = {
      $queryRaw: jest.fn().mockResolvedValue([
        {
          codigoEspecialidad: '016',
          especialidad: '890201 - MEDICINA GENERAL',
          cups: '890201',
        },
      ]),
    } as unknown as PrismaService;
    const prismaBot = {
      botEpsSpecialtyRule: {
        findMany: jest.fn().mockResolvedValue([{ specialtyCode: '890201' }]),
      },
    } as unknown as PrismaBotService;

    const repository = new PrismaPatientSpecialtyEligibilityRepository(
      prisma,
      prismaBot,
    );
    const specialties = await repository.findEligibleSpecialties({
      epsCode: 'EPS042',
      userType: '01',
      sex: 'H',
    });

    expect(specialties).toEqual([
      {
        code: '890201',
        name: 'MEDICINA GENERAL',
        cups: '890201',
      },
    ]);
  });
});
