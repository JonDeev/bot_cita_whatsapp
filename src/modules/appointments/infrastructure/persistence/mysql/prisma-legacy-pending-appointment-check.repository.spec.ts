import { PrismaService } from '../../../../../shared/infrastructure/prisma/prisma.service';
import { PrismaLegacyPendingAppointmentCheckRepository } from './prisma-legacy-pending-appointment-check.repository';

describe('PrismaLegacyPendingAppointmentCheckRepository', () => {
  it('maps the nearest pending appointment row returned by legacy query', async () => {
    const prisma = {
      $queryRaw: jest.fn().mockResolvedValue([
        {
          slotRef: 101,
          appointmentDateIso: '2026-05-30',
          appointmentTimeHHmm: '11:40',
          modalityId: 0,
          professionalName: 'ALICAN MARIA ZAMBRANO PIZARRO',
          siteName: 'Santa Marta',
          siteAddress: 'Carrera 19',
          patientFirstName: 'MARIA',
          patientSecondName: 'FERNANDA',
          patientFirstLastName: 'PEREZ',
          patientSecondLastName: 'LOPEZ',
        },
      ]),
    } as unknown as PrismaService;

    const repository = new PrismaLegacyPendingAppointmentCheckRepository(prisma);
    const appointment = await repository.findNearestPendingFutureAppointmentByPatientAndSpecialty({
      patientUserId: '77',
      specialtyCups: '890201',
      currentDateIso: '2026-05-06',
      currentTimeHHmm: '10:30',
    });

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(appointment).toEqual({
      slotRef: '101',
      appointmentDateIso: '2026-05-30',
      appointmentTimeHHmm: '11:40',
      modalityId: 0,
      professionalName: 'ALICAN MARIA ZAMBRANO PIZARRO',
      siteName: 'Santa Marta',
      siteAddress: 'Carrera 19',
      patientFirstName: 'MARIA',
      patientSecondName: 'FERNANDA',
      patientFirstLastName: 'PEREZ',
      patientSecondLastName: 'LOPEZ',
    });
  });

  it('returns null when row does not include required appointment fields', async () => {
    const prisma = {
      $queryRaw: jest.fn().mockResolvedValue([
        {
          slotRef: 101,
          appointmentDateIso: null,
          appointmentTimeHHmm: '11:40',
          modalityId: 0,
          professionalName: 'MEDICO',
          siteName: 'Sede',
          siteAddress: 'Direccion',
          patientFirstName: 'MARIA',
          patientSecondName: null,
          patientFirstLastName: 'PEREZ',
          patientSecondLastName: null,
        },
      ]),
    } as unknown as PrismaService;

    const repository = new PrismaLegacyPendingAppointmentCheckRepository(prisma);
    const appointment = await repository.findNearestPendingFutureAppointmentByPatientAndSpecialty({
      patientUserId: '77',
      specialtyCups: '890201',
      currentDateIso: '2026-05-06',
      currentTimeHHmm: '10:30',
    });

    expect(appointment).toBeNull();
  });
});
