import { PrismaService } from '../../../../../shared/infrastructure/prisma/prisma.service';
import { PrismaLegacyAppointmentReschedulingRepository } from './prisma-legacy-appointment-rescheduling.repository';

describe('PrismaLegacyAppointmentReschedulingRepository', () => {
  function buildCommand() {
    return {
      patientUserId: '98',
      patientPhone: '3001112233',
      originalSlotRef: '101',
      preferredNewSlotRef: '202',
      specialtyCups: '890201',
      appointmentDateIso: '2026-05-20',
      appointmentTimeHHmm: '11:40',
      currentDateIso: '2026-05-06',
      currentTimeHHmm: '10:30',
      requestDateIso: '2026-05-06',
      canceledDateIso: '2026-05-06',
      requiredSiteId: 109,
    } as const;
  }

  it('returns original not rebookable when original slot ref is invalid', async () => {
    const prisma = {
      $transaction: jest.fn(),
    } as unknown as PrismaService;

    const repository = new PrismaLegacyAppointmentReschedulingRepository(
      prisma,
    );
    const result =
      await repository.rescheduleAssignedFutureAppointmentByPatient({
        ...buildCommand(),
        originalSlotRef: 'abc',
      });

    expect(result).toEqual({ status: 'ORIGINAL_APPOINTMENT_NOT_REBOOKABLE' });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('reschedules successfully with preferred slot', async () => {
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([{ slotRef: 101 }]),
      $executeRaw: jest
        .fn()
        .mockResolvedValueOnce(1) // assign preferred
        .mockResolvedValueOnce(1), // release original
    };
    const prisma = {
      $transaction: jest
        .fn()
        .mockImplementation(async (callback) => callback(tx)),
    } as unknown as PrismaService;

    const repository = new PrismaLegacyAppointmentReschedulingRepository(
      prisma,
    );
    const result =
      await repository.rescheduleAssignedFutureAppointmentByPatient(
        buildCommand(),
      );

    expect(result).toEqual({
      status: 'RESCHEDULED',
      assignedSlotRef: '202',
      usedFallbackSlot: false,
    });
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    expect(tx.$executeRaw).toHaveBeenCalledTimes(2);
  });

  it('returns original not rebookable and rolls back when release update affects zero rows', async () => {
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([{ slotRef: 101 }]),
      $executeRaw: jest
        .fn()
        .mockResolvedValueOnce(1) // assign preferred
        .mockResolvedValueOnce(0), // release original
    };
    const prisma = {
      $transaction: jest
        .fn()
        .mockImplementation(async (callback) => callback(tx)),
    } as unknown as PrismaService;

    const repository = new PrismaLegacyAppointmentReschedulingRepository(
      prisma,
    );
    const result =
      await repository.rescheduleAssignedFutureAppointmentByPatient(
        buildCommand(),
      );

    expect(result).toEqual({ status: 'ORIGINAL_APPOINTMENT_NOT_REBOOKABLE' });
  });
});
