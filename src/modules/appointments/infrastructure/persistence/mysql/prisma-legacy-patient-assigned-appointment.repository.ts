import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../../shared/infrastructure/prisma/prisma.service';
import type {
  FindFutureAssignedAppointmentsByPatientFilters,
  FutureAssignedAppointmentCandidate,
  PatientAssignedAppointmentRepository,
} from '../../../domain/ports/patient-assigned-appointment.repository';

@Injectable()
export class PrismaLegacyPatientAssignedAppointmentRepository implements PatientAssignedAppointmentRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findFutureAssignedAppointmentsByPatient(
    filters: FindFutureAssignedAppointmentsByPatientFilters,
  ): Promise<FutureAssignedAppointmentCandidate[]> {
    const rows = await this.prisma.$queryRaw<
      Array<{
        slotRef: number | null;
        appointmentDateIso: string | null;
        appointmentTimeHHmm: string | null;
        specialtyName: string | null;
        specialtyCups: string | null;
        professionalName: string | null;
        siteName: string | null;
        siteAddress: string | null;
      }>
    >(Prisma.sql`
      SELECT
        a.idagenda AS slotRef,
        DATE_FORMAT(a.fecha_cita, '%Y-%m-%d') AS appointmentDateIso,
        DATE_FORMAT(STR_TO_DATE(TRIM(COALESCE(a.idhora, '')), '%H:%i'), '%H:%i') AS appointmentTimeHHmm,
        COALESCE(
          NULLIF(TRIM(COALESCE(teByCups.Especialidad, '')), ''),
          (
            SELECT TRIM(COALESCE(teFallback.Especialidad, ''))
            FROM especialidad_empleados ee2
            LEFT JOIN tvespecialidades teFallback
              ON TRIM(ee2.\`Código_especialidad\`) = TRIM(teFallback.CodigoEspecialidad)
            WHERE TRIM(ee2.\`Código_empleado\`) = TRIM(a.idmedico)
            ORDER BY COALESCE(ee2.Principal, 0) DESC, TRIM(ee2.\`Código_especialidad\`) ASC
            LIMIT 1
          )
        ) AS specialtyName,
        NULLIF(TRIM(COALESCE(a.TipoCita, '')), '') AS specialtyCups,
        TRIM(COALESCE(e.Nombre_empleado, '')) AS professionalName,
        TRIM(COALESCE(s.Sede, '')) AS siteName,
        TRIM(COALESCE(s.Direccion, '')) AS siteAddress
      FROM agenda a
      LEFT JOIN empleados e
        ON TRIM(a.idmedico) = TRIM(e.\`Código_empleado\`)
      LEFT JOIN sedes s
        ON a.IdSede = s.IdSede
      LEFT JOIN tvespecialidades teByCups
        ON TRIM(COALESCE(a.TipoCita, '')) <> ''
       AND TRIM(COALESCE(teByCups.CUPS, '')) = TRIM(COALESCE(a.TipoCita, ''))
      WHERE TRIM(COALESCE(a.Estado, '')) = 'Asignada'
        AND TRIM(COALESCE(a.idusuario, '')) = ${filters.patientUserId}
        AND STR_TO_DATE(TRIM(COALESCE(a.idhora, '')), '%H:%i') IS NOT NULL
        AND (
          a.fecha_cita > STR_TO_DATE(${filters.currentDateIso}, '%Y-%m-%d')
          OR (
            a.fecha_cita = STR_TO_DATE(${filters.currentDateIso}, '%Y-%m-%d')
            AND STR_TO_DATE(TRIM(a.idhora), '%H:%i')
              > STR_TO_DATE(${filters.currentTimeHHmm}, '%H:%i')
          )
        )
      ORDER BY
        a.fecha_cita ASC,
        STR_TO_DATE(TRIM(a.idhora), '%H:%i') ASC,
        a.idagenda ASC
      LIMIT ${filters.maxResults}
      OFFSET ${filters.offset}
    `);

    return rows
      .map((row) => ({
        slotRef: row.slotRef === null ? '' : String(row.slotRef),
        appointmentDateIso: row.appointmentDateIso?.trim() ?? '',
        appointmentTimeHHmm: row.appointmentTimeHHmm?.trim() ?? '',
        specialtyName: row.specialtyName?.trim() || null,
        specialtyCups: row.specialtyCups?.trim() || null,
        professionalName: row.professionalName?.trim() || null,
        siteName: row.siteName?.trim() || null,
        siteAddress: row.siteAddress?.trim() || null,
      }))
      .filter(
        (row) =>
          row.slotRef.length > 0 &&
          row.appointmentDateIso.length > 0 &&
          row.appointmentTimeHHmm.length > 0,
      );
  }
}
