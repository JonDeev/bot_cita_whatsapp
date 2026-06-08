import { PrismaLegacyAppointmentReminderEligibilityRepository } from './prisma-legacy-appointment-reminder-eligibility.repository';

describe('PrismaLegacyAppointmentReminderEligibilityRepository', () => {
  it('keeps morning business appointments within the reminder eligibility window', async () => {
    const prisma = {
      agenda: {
        findMany: jest.fn().mockResolvedValue([
          {
            idagenda: 103,
            idusuario: '17',
            IdSede: 7,
            fecha_cita: new Date('2026-06-10T00:00:00.000Z'),
            idhora: '07:00',
            Estado: 'Asignada',
            IdModalidad: 0,
            idmedico: 'DOC03',
          },
        ]),
      },
      usuarios: {
        findMany: jest.fn().mockResolvedValue([
          {
            IdUsuario: 17,
            Primer_nombre: 'ANA',
            Primer_apellido: 'PEREZ',
            Tel_fono: '3005550101',
            telefono_verificado_en: null,
          },
        ]),
      },
      empleados: {
        findMany: jest.fn().mockResolvedValue([
          {
            C_digo_empleado: 'DOC03',
            Nombre_empleado: 'MEDICO 3',
          },
        ]),
      },
      especialidad_empleados: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      tvespecialidades: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      sedes: {
        findMany: jest.fn().mockResolvedValue([
          {
            IdSede: 7,
            Sede: 'SANTA MARTA',
            Direccion: 'CALLE 24 # 6-30',
          },
        ]),
      },
    };

    const repository = new PrismaLegacyAppointmentReminderEligibilityRepository(
      prisma as any,
    );

    const results = await repository.findFutureAssignedAppointments({
      nowIso: '2026-06-09T12:30:00.000Z',
      maxWindowHours: 48,
      limit: 10,
    });

    expect(results).toHaveLength(1);
    expect(results[0]?.appointmentDateIso).toBe('2026-06-10T00:00:00.000Z');
    expect(results[0]?.appointmentTimeHhmm).toBe('07:00');
  });

  it('resolves specialty and site details from legacy tables', async () => {
    const prisma = {
      agenda: {
        findMany: jest.fn().mockResolvedValue([
          {
            idagenda: 101,
            idusuario: '15',
            IdSede: 7,
            fecha_cita: new Date('2026-06-01T00:00:00.000Z'),
            idhora: '08:00',
            Estado: 'Asignada',
            IdModalidad: 0,
            idmedico: 'DOC01',
          },
        ]),
      },
      usuarios: {
        findMany: jest.fn().mockResolvedValue([
          {
            IdUsuario: 15,
            Primer_nombre: 'ADRIANA',
            Primer_apellido: 'RUIZ',
            Tel_fono: '3001234567',
            telefono_verificado_en: null,
          },
        ]),
      },
      empleados: {
        findMany: jest.fn().mockResolvedValue([
          {
            C_digo_empleado: 'DOC01',
            Nombre_empleado: 'MEDICO 1',
          },
        ]),
      },
      especialidad_empleados: {
        findMany: jest.fn().mockResolvedValue([
          {
            C_digo_empleado: 'DOC01',
            C_digo_especialidad: '001',
            Principal: true,
          },
          {
            C_digo_empleado: 'DOC01',
            C_digo_especialidad: '002',
            Principal: false,
          },
        ]),
      },
      tvespecialidades: {
        findMany: jest.fn().mockResolvedValue([
          {
            CodigoEspecialidad: '001',
            Especialidad: 'MEDICINA GENERAL',
          },
          {
            CodigoEspecialidad: '002',
            Especialidad: 'PEDIATRIA',
          },
        ]),
      },
      sedes: {
        findMany: jest.fn().mockResolvedValue([
          {
            IdSede: 7,
            Sede: 'SANTA MARTA',
            Direccion: 'CALLE 24 # 6-30',
          },
        ]),
      },
    };

    const repository = new PrismaLegacyAppointmentReminderEligibilityRepository(
      prisma as any,
    );

    const [result] = await repository.findByLegacyAgendaIds([101]);

    expect(result.specialtyName).toBe('MEDICINA GENERAL');
    expect(result.siteCity).toBe('SANTA MARTA');
    expect(result.siteAddress).toBe('CALLE 24 # 6-30');
  });

  it('returns null specialty when doctor has multiple non-principal specialties', async () => {
    const prisma = {
      agenda: {
        findMany: jest.fn().mockResolvedValue([
          {
            idagenda: 102,
            idusuario: '16',
            IdSede: null,
            fecha_cita: new Date('2026-06-01T00:00:00.000Z'),
            idhora: '09:00',
            Estado: 'Asignada',
            IdModalidad: 0,
            idmedico: 'DOC02',
          },
        ]),
      },
      usuarios: {
        findMany: jest.fn().mockResolvedValue([
          {
            IdUsuario: 16,
            Primer_nombre: 'PAOLA',
            Primer_apellido: 'GARCIA',
            Tel_fono: '3007654321',
            telefono_verificado_en: null,
          },
        ]),
      },
      empleados: {
        findMany: jest.fn().mockResolvedValue([
          {
            C_digo_empleado: 'DOC02',
            Nombre_empleado: 'MEDICO 2',
          },
        ]),
      },
      especialidad_empleados: {
        findMany: jest.fn().mockResolvedValue([
          {
            C_digo_empleado: 'DOC02',
            C_digo_especialidad: '010',
            Principal: false,
          },
          {
            C_digo_empleado: 'DOC02',
            C_digo_especialidad: '011',
            Principal: false,
          },
        ]),
      },
      tvespecialidades: {
        findMany: jest.fn().mockResolvedValue([
          {
            CodigoEspecialidad: '010',
            Especialidad: 'DERMATOLOGIA',
          },
          {
            CodigoEspecialidad: '011',
            Especialidad: 'GINECOLOGIA',
          },
        ]),
      },
      sedes: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };

    const repository = new PrismaLegacyAppointmentReminderEligibilityRepository(
      prisma as any,
    );

    const [result] = await repository.findByLegacyAgendaIds([102]);
    expect(result.specialtyName).toBeNull();
  });
});
