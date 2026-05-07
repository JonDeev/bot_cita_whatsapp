import { PrismaService } from '../../../../../shared/infrastructure/prisma/prisma.service';
import { PrismaLegacyAppointmentCancellationRepository } from './prisma-legacy-appointment-cancellation.repository';

describe('PrismaLegacyAppointmentCancellationRepository', () => {
  it('returns true when guarded cancellation update affects one row', async () => {
    const prisma = {
      $executeRaw: jest.fn().mockResolvedValue(1),
    } as unknown as PrismaService;

    const repository = new PrismaLegacyAppointmentCancellationRepository(prisma);
    const cancelled = await repository.cancelAssignedFutureAppointmentByPatient({
      slotRef: '101',
      patientUserId: '98',
      currentDateIso: '2026-05-06',
      currentTimeHHmm: '10:30',
      canceledDateIso: '2026-05-06',
    });

    expect(prisma.$executeRaw).toHaveBeenCalledTimes(1);
    expect(cancelled).toBe(true);
  });

  it('returns false when slot ref is invalid', async () => {
    const prisma = {
      $executeRaw: jest.fn(),
    } as unknown as PrismaService;

    const repository = new PrismaLegacyAppointmentCancellationRepository(prisma);
    const cancelled = await repository.cancelAssignedFutureAppointmentByPatient({
      slotRef: 'abc',
      patientUserId: '98',
      currentDateIso: '2026-05-06',
      currentTimeHHmm: '10:30',
      canceledDateIso: '2026-05-06',
    });

    expect(cancelled).toBe(false);
    expect(prisma.$executeRaw).not.toHaveBeenCalled();
  });
});
