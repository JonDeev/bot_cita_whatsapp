import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../../shared/infrastructure/prisma/prisma.service';
import type {
  AppointmentReminderEligibilityRepository,
  EligibleAppointmentForReminder,
} from '../../../domain/ports/appointment-reminder-eligibility.repository';
import { resolveAppointmentStartsAtFromDate } from '../../../domain/appointment-reminder-timezone';

interface LegacyAgendaSnapshot {
  legacyAgendaId: number;
  patientLegacyUserId: number;
  siteLegacyId: number | null;
  appointmentDateIso: string;
  appointmentTimeHhmm: string;
  legacyState: string | null;
  modalityId: number;
  doctorId: string;
}

interface LegacyDoctorSpecialtySnapshot {
  doctorId: string;
  specialtyCode: string;
  isPrincipal: boolean;
}

interface LegacySiteSnapshot {
  siteLegacyId: number;
  siteName: string | null;
  siteAddress: string | null;
}

@Injectable()
export class PrismaLegacyAppointmentReminderEligibilityRepository implements AppointmentReminderEligibilityRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findFutureAssignedAppointments(input: {
    nowIso: string;
    maxWindowHours: number;
    limit: number;
  }): Promise<EligibleAppointmentForReminder[]> {
    const now = new Date(input.nowIso);
    const maxWindowEnd = new Date(
      now.getTime() + input.maxWindowHours * 60 * 60 * 1000,
    );
    const lowerDateBound = new Date(now);
    lowerDateBound.setUTCHours(0, 0, 0, 0);
    const upperDateBound = new Date(maxWindowEnd);
    upperDateBound.setUTCHours(23, 59, 59, 999);

    const agendas = await this.prisma.agenda.findMany({
      where: {
        Estado: 'Asignada',
        fecha_cita: {
          gte: lowerDateBound,
          lte: upperDateBound,
        },
      },
      orderBy: [{ fecha_cita: 'asc' }, { idhora: 'asc' }, { idagenda: 'asc' }],
      take: Math.max(input.limit * 3, input.limit),
      select: {
        idagenda: true,
        idusuario: true,
        IdSede: true,
        fecha_cita: true,
        idhora: true,
        Estado: true,
        IdModalidad: true,
        idmedico: true,
      },
    });

    const snapshots: LegacyAgendaSnapshot[] = [];

    for (const agenda of agendas) {
      const patientLegacyUserId = Number.parseInt(agenda.idusuario ?? '', 10);
      if (!Number.isInteger(patientLegacyUserId) || patientLegacyUserId <= 0) {
        continue;
      }

      const appointmentStartsAt = this.resolveAppointmentStartsAt(
        agenda.fecha_cita,
        agenda.idhora,
      );

      if (appointmentStartsAt <= now || appointmentStartsAt > maxWindowEnd) {
        continue;
      }

      snapshots.push({
        legacyAgendaId: agenda.idagenda,
        patientLegacyUserId,
        siteLegacyId: agenda.IdSede,
        appointmentDateIso: agenda.fecha_cita.toISOString(),
        appointmentTimeHhmm: agenda.idhora,
        legacyState: agenda.Estado,
        modalityId: agenda.IdModalidad,
        doctorId: agenda.idmedico,
      });

      if (snapshots.length >= input.limit) {
        break;
      }
    }

    return this.enrichSnapshots(snapshots);
  }

  async findByLegacyAgendaIds(
    legacyAgendaIds: readonly number[],
  ): Promise<EligibleAppointmentForReminder[]> {
    if (legacyAgendaIds.length === 0) {
      return [];
    }

    const agendas = await this.prisma.agenda.findMany({
      where: {
        idagenda: {
          in: [...legacyAgendaIds],
        },
      },
      orderBy: [{ idagenda: 'asc' }],
      select: {
        idagenda: true,
        idusuario: true,
        IdSede: true,
        fecha_cita: true,
        idhora: true,
        Estado: true,
        IdModalidad: true,
        idmedico: true,
      },
    });

    const snapshots: LegacyAgendaSnapshot[] = [];
    for (const agenda of agendas) {
      const patientLegacyUserId = Number.parseInt(agenda.idusuario ?? '', 10);
      if (!Number.isInteger(patientLegacyUserId) || patientLegacyUserId <= 0) {
        continue;
      }

      snapshots.push({
        legacyAgendaId: agenda.idagenda,
        patientLegacyUserId,
        siteLegacyId: agenda.IdSede,
        appointmentDateIso: agenda.fecha_cita.toISOString(),
        appointmentTimeHhmm: agenda.idhora,
        legacyState: agenda.Estado,
        modalityId: agenda.IdModalidad,
        doctorId: agenda.idmedico,
      });
    }

    return this.enrichSnapshots(snapshots);
  }

  private async enrichSnapshots(
    snapshots: LegacyAgendaSnapshot[],
  ): Promise<EligibleAppointmentForReminder[]> {
    if (snapshots.length === 0) {
      return [];
    }

    const patientIds = [
      ...new Set(snapshots.map((item) => item.patientLegacyUserId)),
    ];
    const doctorIds = [...new Set(snapshots.map((item) => item.doctorId))];
    const siteIds = [
      ...new Set(
        snapshots
          .map((item) => item.siteLegacyId)
          .filter((value): value is number => Number.isInteger(value)),
      ),
    ];

    const [patients, doctors, sites] = await Promise.all([
      this.prisma.usuarios.findMany({
        where: {
          IdUsuario: {
            in: patientIds,
          },
        },
        select: {
          IdUsuario: true,
          Primer_nombre: true,
          Primer_apellido: true,
          Tel_fono: true,
          telefono_verificado_en: true,
        },
      }),
      this.prisma.empleados.findMany({
        where: {
          C_digo_empleado: {
            in: doctorIds,
          },
        },
        select: {
          C_digo_empleado: true,
          Nombre_empleado: true,
        },
      }),
      this.prisma.sedes.findMany({
        where: {
          IdSede: {
            in: siteIds,
          },
        },
        select: {
          IdSede: true,
          Sede: true,
          Direccion: true,
        },
      }),
    ]);
    const doctorSpecialties = await this.prisma.especialidad_empleados.findMany(
      {
        where: {
          C_digo_empleado: {
            in: doctorIds,
          },
        },
        select: {
          C_digo_empleado: true,
          C_digo_especialidad: true,
          Principal: true,
        },
      },
    );
    const specialtyCodes = [
      ...new Set(
        doctorSpecialties.map((item) => item.C_digo_especialidad.trim()),
      ),
    ];
    const specialties = await this.prisma.tvespecialidades.findMany({
      where: {
        CodigoEspecialidad: {
          in: specialtyCodes,
        },
      },
      select: {
        CodigoEspecialidad: true,
        Especialidad: true,
      },
    });

    const patientsById = new Map(
      patients.map((item) => [item.IdUsuario, item]),
    );
    const doctorsById = new Map(
      doctors.map((item) => [item.C_digo_empleado, item]),
    );
    const sitesById = new Map(
      sites.map((item) => [
        item.IdSede,
        {
          siteLegacyId: item.IdSede,
          siteName: item.Sede?.trim() ?? null,
          siteAddress: item.Direccion?.trim() ?? null,
        } satisfies LegacySiteSnapshot,
      ]),
    );
    const specialtyNamesByCode = new Map(
      specialties.map((item) => [
        item.CodigoEspecialidad,
        item.Especialidad?.trim() ?? null,
      ]),
    );
    const specialtiesByDoctor = this.groupSpecialtiesByDoctor(
      doctorSpecialties.map((item) => ({
        doctorId: item.C_digo_empleado,
        specialtyCode: item.C_digo_especialidad.trim(),
        isPrincipal: item.Principal === true,
      })),
      specialtyNamesByCode,
    );

    const results: EligibleAppointmentForReminder[] = [];

    for (const snapshot of snapshots) {
      const patient = patientsById.get(snapshot.patientLegacyUserId);
      if (!patient) {
        continue;
      }
      const site = snapshot.siteLegacyId
        ? sitesById.get(snapshot.siteLegacyId)
        : null;

      results.push({
        legacyAgendaId: snapshot.legacyAgendaId,
        patientLegacyUserId: snapshot.patientLegacyUserId,
        patientPhoneRaw: patient.Tel_fono,
        patientFirstName: patient.Primer_nombre,
        patientLastName: patient.Primer_apellido,
        patientPhoneVerifiedAtIso: patient.telefono_verificado_en
          ? patient.telefono_verificado_en.toISOString()
          : null,
        appointmentDateIso: snapshot.appointmentDateIso,
        appointmentTimeHhmm: snapshot.appointmentTimeHhmm,
        legacyState: snapshot.legacyState,
        modalityId: snapshot.modalityId,
        specialtyName: specialtiesByDoctor.get(snapshot.doctorId) ?? null,
        doctorName: doctorsById.get(snapshot.doctorId)?.Nombre_empleado ?? null,
        siteCity: site?.siteName ?? null,
        siteAddress: site?.siteAddress ?? null,
      });
    }

    return results;
  }

  private groupSpecialtiesByDoctor(
    snapshots: LegacyDoctorSpecialtySnapshot[],
    specialtyNamesByCode: ReadonlyMap<string, string | null>,
  ): Map<string, string | null> {
    const grouped = new Map<string, LegacyDoctorSpecialtySnapshot[]>();
    for (const snapshot of snapshots) {
      const current = grouped.get(snapshot.doctorId) ?? [];
      current.push(snapshot);
      grouped.set(snapshot.doctorId, current);
    }

    const resolved = new Map<string, string | null>();
    for (const [doctorId, doctorSpecialties] of grouped.entries()) {
      const principalMatches = doctorSpecialties
        .filter((item) => item.isPrincipal)
        .map((item) => specialtyNamesByCode.get(item.specialtyCode) ?? null)
        .filter((item): item is string => Boolean(item));

      if (principalMatches.length === 1) {
        resolved.set(doctorId, principalMatches[0]);
        continue;
      }

      const distinctNames = [
        ...new Set(
          doctorSpecialties
            .map((item) => specialtyNamesByCode.get(item.specialtyCode) ?? null)
            .filter((item): item is string => Boolean(item)),
        ),
      ];

      resolved.set(
        doctorId,
        distinctNames.length === 1 ? distinctNames[0] : null,
      );
    }

    return resolved;
  }

  private resolveAppointmentStartsAt(
    appointmentDate: Date,
    appointmentTimeHhmm: string,
  ): Date {
    try {
      return resolveAppointmentStartsAtFromDate({
        appointmentDate,
        appointmentTimeHhmm,
      });
    } catch {
      return new Date(appointmentDate);
    }
  }
}
