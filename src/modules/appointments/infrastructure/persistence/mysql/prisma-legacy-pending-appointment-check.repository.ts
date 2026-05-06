import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../../shared/infrastructure/prisma/prisma.service';
import type {
  FindNearestPendingFutureAppointmentFilters,
  PendingAppointmentCheckRepository,
  PendingFutureAppointmentCandidate,
} from '../../../domain/ports/pending-appointment-check.repository';

@Injectable()
export class PrismaLegacyPendingAppointmentCheckRepository
  implements PendingAppointmentCheckRepository
{
  constructor(private readonly prisma: PrismaService) {}

  async findNearestPendingFutureAppointmentByPatientAndSpecialty(
    filters: FindNearestPendingFutureAppointmentFilters,
  ): Promise<PendingFutureAppointmentCandidate | null> {
    const rows = await this.prisma.$queryRaw<
      Array<{
        slotRef: number | null;
        appointmentDateIso: string | null;
        appointmentTimeHHmm: string | null;
        modalityId: number | null;
        professionalName: string | null;
        siteName: string | null;
        siteAddress: string | null;
        patientFirstName: string | null;
        patientSecondName: string | null;
        patientFirstLastName: string | null;
        patientSecondLastName: string | null;
      }>
    >(Prisma.sql`
      SELECT
        a.idagenda AS slotRef,
        DATE_FORMAT(a.fecha_cita, '%Y-%m-%d') AS appointmentDateIso,
        DATE_FORMAT(STR_TO_DATE(TRIM(COALESCE(a.idhora, '')), '%H:%i'), '%H:%i') AS appointmentTimeHHmm,
        a.IdModalidad AS modalityId,
        e.Nombre_empleado AS professionalName,
        s.Sede AS siteName,
        s.Direccion AS siteAddress,
        u.Primer_nombre AS patientFirstName,
        u.Segundo_nombre AS patientSecondName,
        u.Primer_apellido AS patientFirstLastName,
        u.Segundo_apellido AS patientSecondLastName
      FROM agenda a
      LEFT JOIN empleados e
        ON TRIM(a.idmedico) = TRIM(e.\`Código_empleado\`)
      LEFT JOIN sedes s
        ON a.IdSede = s.IdSede
      LEFT JOIN usuarios u
        ON u.IdUsuario = CAST(${filters.patientUserId} AS UNSIGNED)
      WHERE TRIM(COALESCE(a.Estado, '')) = 'Asignada'
        AND TRIM(COALESCE(a.idusuario, '')) = ${filters.patientUserId}
        AND STR_TO_DATE(TRIM(COALESCE(a.idhora, '')), '%H:%i') IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM especialidad_empleados ee
          WHERE TRIM(a.idmedico) = TRIM(ee.\`Código_empleado\`)
            AND TRIM(COALESCE(ee.Cups, '')) = ${filters.specialtyCups}
        )
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
      LIMIT 1
    `);

    const row = rows.at(0);
    if (!row?.slotRef || !row.appointmentDateIso || !row.appointmentTimeHHmm) {
      return null;
    }

    return {
      slotRef: String(row.slotRef),
      appointmentDateIso: row.appointmentDateIso.trim(),
      appointmentTimeHHmm: row.appointmentTimeHHmm.trim(),
      modalityId: row.modalityId,
      professionalName: row.professionalName?.trim() ?? null,
      siteName: row.siteName?.trim() ?? null,
      siteAddress: row.siteAddress?.trim() ?? null,
      patientFirstName: row.patientFirstName?.trim() ?? null,
      patientSecondName: row.patientSecondName?.trim() ?? null,
      patientFirstLastName: row.patientFirstLastName?.trim() ?? null,
      patientSecondLastName: row.patientSecondLastName?.trim() ?? null,
    };
  }
}
