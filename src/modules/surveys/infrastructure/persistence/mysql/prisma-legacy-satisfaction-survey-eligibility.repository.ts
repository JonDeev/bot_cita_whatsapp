import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../../shared/infrastructure/prisma/prisma.service';
import type {
  FindEligibleAppointmentsByWindowFilters,
  SatisfactionSurveyEligibilityRepository,
  SatisfactionSurveyEligibleAppointment,
} from '../../../domain/ports/satisfaction-survey-eligibility.repository';

@Injectable()
export class PrismaLegacySatisfactionSurveyEligibilityRepository implements SatisfactionSurveyEligibilityRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findEligibleAppointmentsByWindow(
    filters: FindEligibleAppointmentsByWindowFilters,
  ): Promise<SatisfactionSurveyEligibleAppointment[]> {
    const rows = await this.prisma.$queryRaw<
      Array<{
        legacyAgendaId: number | null;
        patientLegacyUserId: number | null;
        patientName: string | null;
        patientPhone: string | null;
        appointmentDateIso: string | null;
        appointmentTimeHhmm: string | null;
        specialtyName: string | null;
        doctorName: string | null;
        siteName: string | null;
      }>
    >(Prisma.sql`
      SELECT
        a.idagenda AS legacyAgendaId,
        a.idusuario AS patientLegacyUserId,
        TRIM(
          CONCAT(
            COALESCE(u.Primer_nombre, ''),
            IF(TRIM(COALESCE(u.Segundo_nombre, '')) = '', '', CONCAT(' ', u.Segundo_nombre)),
            IF(TRIM(COALESCE(u.Primer_apellido, '')) = '', '', CONCAT(' ', u.Primer_apellido)),
            IF(TRIM(COALESCE(u.Segundo_apellido, '')) = '', '', CONCAT(' ', u.Segundo_apellido))
          )
        ) AS patientName,
        TRIM(COALESCE(u.Tel_fono, '')) AS patientPhone,
        DATE_FORMAT(a.fecha_cita, '%Y-%m-%d') AS appointmentDateIso,
        DATE_FORMAT(STR_TO_DATE(TRIM(COALESCE(a.idhora, '')), '%H:%i'), '%H:%i') AS appointmentTimeHhmm,
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
        TRIM(COALESCE(e.Nombre_empleado, '')) AS doctorName,
        TRIM(COALESCE(s.Sede, '')) AS siteName
      FROM agenda a
      INNER JOIN usuarios u
        ON u.IdUsuario = a.idusuario
      LEFT JOIN empleados e
        ON TRIM(a.idmedico) = TRIM(e.\`Código_empleado\`)
      LEFT JOIN sedes s
        ON a.IdSede = s.IdSede
      LEFT JOIN tvespecialidades teByCups
        ON TRIM(COALESCE(a.TipoCita, '')) <> ''
       AND TRIM(COALESCE(teByCups.CUPS, '')) = TRIM(COALESCE(a.TipoCita, ''))
      WHERE a.fecha_cita = STR_TO_DATE(${filters.surveyDateIso}, '%Y-%m-%d')
        AND TRIM(COALESCE(a.Estado, '')) = 'Atendida'
        AND TRIM(COALESCE(a.notificacion_encuesta, '')) = 'No enviado'
        AND STR_TO_DATE(TRIM(COALESCE(a.idhora, '')), '%H:%i') IS NOT NULL
        AND STR_TO_DATE(TRIM(a.idhora), '%H:%i') >= STR_TO_DATE(${filters.windowStartHHmm}, '%H:%i')
        AND STR_TO_DATE(TRIM(a.idhora), '%H:%i') < STR_TO_DATE(${filters.windowEndHHmm}, '%H:%i')
      ORDER BY
        a.idusuario ASC,
        a.fecha_cita ASC,
        STR_TO_DATE(TRIM(a.idhora), '%H:%i') ASC,
        a.idagenda ASC
    `);

    return rows
      .map(
        (row): SatisfactionSurveyEligibleAppointment => ({
          legacyAgendaId: row.legacyAgendaId ?? 0,
          patientLegacyUserId: row.patientLegacyUserId ?? 0,
          patientName: row.patientName?.trim() ?? '',
          patientPhone: row.patientPhone?.trim() || null,
          appointmentDateIso: row.appointmentDateIso?.trim() ?? '',
          appointmentTimeHhmm: row.appointmentTimeHhmm?.trim() ?? '',
          specialtyName: row.specialtyName?.trim() || null,
          doctorName: row.doctorName?.trim() || null,
          siteName: row.siteName?.trim() || null,
        }),
      )
      .filter(
        (row) =>
          row.legacyAgendaId > 0 &&
          row.patientLegacyUserId > 0 &&
          row.patientName.length > 0 &&
          row.appointmentDateIso.length > 0 &&
          row.appointmentTimeHhmm.length > 0,
      );
  }
}
