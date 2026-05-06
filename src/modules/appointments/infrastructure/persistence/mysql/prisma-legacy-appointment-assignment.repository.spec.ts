import { PrismaService } from '../../../../../shared/infrastructure/prisma/prisma.service';
import { PrismaLegacyAppointmentAssignmentRepository } from './prisma-legacy-appointment-assignment.repository';

describe('PrismaLegacyAppointmentAssignmentRepository', () => {
  it('returns true when the guarded update affects one row', async () => {
    const prisma = {
      $executeRaw: jest.fn().mockResolvedValue(1),
      $queryRaw: jest.fn(),
    } as unknown as PrismaService;

    const repository = new PrismaLegacyAppointmentAssignmentRepository(prisma);
    const assigned = await repository.assignSlotIfAvailable({
      slotRef: '101',
      patientUserId: '98',
      patientPhone: '3001112233',
      requestDateIso: '2026-05-06',
      requiredSiteId: 109,
    });

    expect(prisma.$executeRaw).toHaveBeenCalledTimes(1);
    expect(assigned).toBe(true);
  });

  it('maps fallback slot rows from legacy query', async () => {
    const prisma = {
      $executeRaw: jest.fn(),
      $queryRaw: jest.fn().mockResolvedValue([{ slotRef: 203 }]),
    } as unknown as PrismaService;

    const repository = new PrismaLegacyAppointmentAssignmentRepository(prisma);
    const fallback = await repository.findFallbackAvailableSlot({
      specialtyCups: '890201',
      appointmentDateIso: '2026-05-20',
      appointmentTimeHHmm: '11:40',
      requiredSiteId: 109,
      excludeSlotRef: '101',
    });

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(fallback).toEqual({ slotRef: '203' });
  });
});
