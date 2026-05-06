import { PrismaService } from '../../../../../shared/infrastructure/prisma/prisma.service';
import { PrismaLegacyAppointmentAvailabilityRepository } from './prisma-legacy-appointment-availability.repository';

describe('PrismaLegacyAppointmentAvailabilityRepository', () => {
  it('maps non-empty date rows returned by the legacy query', async () => {
    const prisma = {
      $queryRaw: jest.fn().mockResolvedValue([
        { dateIso: '2026-05-06' },
        { dateIso: ' 2026-05-07 ' },
        { dateIso: null },
        { dateIso: '   ' },
      ]),
    } as unknown as PrismaService;

    const repository = new PrismaLegacyAppointmentAvailabilityRepository(prisma);
    const dates = await repository.findAvailableDates({
      specialtyCups: '890201',
      cutoffDateIso: '2026-05-05',
      cutoffTimeHHmm: '12:39',
    });

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(dates).toEqual([{ dateIso: '2026-05-06' }, { dateIso: '2026-05-07' }]);
  });

  it('maps non-empty time rows returned by the legacy query', async () => {
    const prisma = {
      $queryRaw: jest.fn().mockResolvedValue([
        { slotRef: 101, timeHHmm: '08:30' },
        { slotRef: 102, timeHHmm: ' 09:00 ' },
        { slotRef: null, timeHHmm: '10:00' },
        { slotRef: 103, timeHHmm: null },
      ]),
    } as unknown as PrismaService;

    const repository = new PrismaLegacyAppointmentAvailabilityRepository(prisma);
    const times = await repository.findAvailableTimesByDate({
      specialtyCups: '890201',
      dateIso: '2026-05-06',
      minimumTimeHHmm: '07:00',
      maxResults: 9,
    });

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(times).toEqual([
      { slotRef: '101', timeHHmm: '08:30' },
      { slotRef: '102', timeHHmm: '09:00' },
    ]);
  });
});
