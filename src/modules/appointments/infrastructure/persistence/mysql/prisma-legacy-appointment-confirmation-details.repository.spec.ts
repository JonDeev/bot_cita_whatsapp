import { PrismaService } from '../../../../../shared/infrastructure/prisma/prisma.service';
import { PrismaLegacyAppointmentConfirmationDetailsRepository } from './prisma-legacy-appointment-confirmation-details.repository';

describe('PrismaLegacyAppointmentConfirmationDetailsRepository', () => {
  it('maps patient detail fields from usuarios', async () => {
    const prisma = {
      usuarios: {
        findUnique: jest.fn().mockResolvedValue({
          IdUsuario: 98,
          Primer_nombre: 'DANIEL',
          Segundo_nombre: 'ANDRES',
          Primer_apellido: 'CASTANO',
          Segundo_apellido: 'NAVARRO',
          Tel_fono: '3001112233',
        }),
      },
      $queryRaw: jest.fn(),
    } as unknown as PrismaService;

    const repository = new PrismaLegacyAppointmentConfirmationDetailsRepository(
      prisma,
    );
    const patient = await repository.findPatientById(98);

    expect(patient).toEqual({
      userId: 98,
      firstName: 'DANIEL',
      secondName: 'ANDRES',
      firstLastName: 'CASTANO',
      secondLastName: 'NAVARRO',
      phone: '3001112233',
    });
  });

  it('maps assigned appointment confirmation fields', async () => {
    const prisma = {
      usuarios: {
        findUnique: jest.fn(),
      },
      $queryRaw: jest.fn().mockResolvedValue([
        {
          slotRef: 101,
          appointmentDateIso: '2026-04-30',
          appointmentTimeHHmm: '11:40',
          professionalName: 'ALICAN MARIA ZAMBRANO PIZARRO',
          siteName: 'Santa Marta',
          siteAddress: 'Carrera 19',
        },
      ]),
    } as unknown as PrismaService;

    const repository = new PrismaLegacyAppointmentConfirmationDetailsRepository(
      prisma,
    );
    const details = await repository.findAssignedAppointmentBySlotRef('101');

    expect(details).toEqual({
      slotRef: '101',
      appointmentDateIso: '2026-04-30',
      appointmentTimeHHmm: '11:40',
      professionalName: 'ALICAN MARIA ZAMBRANO PIZARRO',
      siteName: 'Santa Marta',
      siteAddress: 'Carrera 19',
    });
  });
});
