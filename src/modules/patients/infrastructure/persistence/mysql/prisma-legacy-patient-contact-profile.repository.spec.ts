import { PrismaService } from '../../../../../shared/infrastructure/prisma/prisma.service';
import { PrismaLegacyPatientContactProfileRepository } from './prisma-legacy-patient-contact-profile.repository';

describe('PrismaLegacyPatientContactProfileRepository', () => {
  it('returns patient contact profile from usuarios', async () => {
    const prisma = {
      usuarios: {
        findUnique: jest.fn().mockResolvedValue({
          IdUsuario: 10,
          Primer_nombre: 'DANIEL',
          Segundo_nombre: null,
          Primer_apellido: 'CASTANO',
          Segundo_apellido: null,
          Tel_fono: '3001234567',
          email: 'daniel@example.com',
          telefono_verificado_en: new Date('2026-05-10T10:00:00.000Z'),
          correo_verificado_en: new Date('2026-05-11T10:00:00.000Z'),
        }),
      },
    } as unknown as PrismaService;

    const repository = new PrismaLegacyPatientContactProfileRepository(prisma);
    const result = await repository.findByPatientId(10);

    expect(result).toEqual({
      patientId: 10,
      firstName: 'DANIEL',
      secondName: null,
      firstLastName: 'CASTANO',
      secondLastName: null,
      primaryPhone: '3001234567',
      primaryEmail: 'daniel@example.com',
      phoneVerifiedAtIso: '2026-05-10T10:00:00.000Z',
      emailVerifiedAtIso: '2026-05-11T10:00:00.000Z',
    });
  });
});
