import { PrismaService } from '../../../../../shared/infrastructure/prisma/prisma.service';
import { PrismaLegacyPatientAssignedAppointmentRepository } from './prisma-legacy-patient-assigned-appointment.repository';

describe('PrismaLegacyPatientAssignedAppointmentRepository', () => {
  it('maps legacy rows to future assigned appointment candidates', async () => {
    const prisma = {
      $queryRaw: jest.fn().mockResolvedValue([
        {
          slotRef: 101,
          appointmentDateIso: '2026-05-30',
          appointmentTimeHHmm: '11:40',
          specialtyName: '890201 - MEDICINA GENERAL',
          specialtyCups: '890201',
          professionalName: 'ALICAN MARIA',
          siteName: 'Sede Central',
          siteAddress: 'Calle 1 # 2-3',
        },
      ]),
    } as unknown as PrismaService;

    const repository = new PrismaLegacyPatientAssignedAppointmentRepository(prisma);
    const appointments = await repository.findFutureAssignedAppointmentsByPatient({
      patientUserId: '98',
      currentDateIso: '2026-05-06',
      currentTimeHHmm: '10:30',
      offset: 0,
      maxResults: 11,
    });

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(appointments).toEqual([
      {
        slotRef: '101',
        appointmentDateIso: '2026-05-30',
        appointmentTimeHHmm: '11:40',
        specialtyName: '890201 - MEDICINA GENERAL',
        specialtyCups: '890201',
        professionalName: 'ALICAN MARIA',
        siteName: 'Sede Central',
        siteAddress: 'Calle 1 # 2-3',
      },
    ]);
  });

  it('drops rows with missing required slot/date/time fields', async () => {
    const prisma = {
      $queryRaw: jest.fn().mockResolvedValue([
        {
          slotRef: null,
          appointmentDateIso: '2026-05-30',
          appointmentTimeHHmm: '11:40',
          specialtyName: 'MEDICINA GENERAL',
          specialtyCups: '890201',
          professionalName: 'MEDICO',
          siteName: null,
          siteAddress: null,
        },
      ]),
    } as unknown as PrismaService;

    const repository = new PrismaLegacyPatientAssignedAppointmentRepository(prisma);
    const appointments = await repository.findFutureAssignedAppointmentsByPatient({
      patientUserId: '98',
      currentDateIso: '2026-05-06',
      currentTimeHHmm: '10:30',
      offset: 0,
      maxResults: 11,
    });

    expect(appointments).toEqual([]);
  });

  it('keeps specialtyName null when mapping source does not resolve a specialty', async () => {
    const prisma = {
      $queryRaw: jest.fn().mockResolvedValue([
        {
          slotRef: 102,
          appointmentDateIso: '2026-05-31',
          appointmentTimeHHmm: '09:00',
          specialtyName: null,
          specialtyCups: null,
          professionalName: 'MEDICO',
          siteName: null,
          siteAddress: null,
        },
      ]),
    } as unknown as PrismaService;

    const repository = new PrismaLegacyPatientAssignedAppointmentRepository(prisma);
    const appointments = await repository.findFutureAssignedAppointmentsByPatient({
      patientUserId: '98',
      currentDateIso: '2026-05-06',
      currentTimeHHmm: '10:30',
      offset: 0,
      maxResults: 11,
    });

    expect(appointments).toEqual([
      {
        slotRef: '102',
        appointmentDateIso: '2026-05-31',
        appointmentTimeHHmm: '09:00',
        specialtyName: null,
        specialtyCups: null,
        professionalName: 'MEDICO',
        siteName: null,
        siteAddress: null,
      },
    ]);
  });
});
