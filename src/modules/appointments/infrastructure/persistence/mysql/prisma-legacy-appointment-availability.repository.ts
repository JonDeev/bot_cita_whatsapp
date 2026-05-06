import { Prisma } from '@prisma/client';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../../shared/infrastructure/prisma/prisma.service';
import type {
  AppointmentAvailabilityRepository,
  AvailableAppointmentDateCandidate,
  AvailableAppointmentTimeCandidate,
  FindAvailableAppointmentDatesFilters,
  FindAvailableAppointmentTimesByDateFilters,
} from '../../../domain/ports/appointment-availability.repository';

@Injectable()
export class PrismaLegacyAppointmentAvailabilityRepository
  implements AppointmentAvailabilityRepository
{
  private static readonly BOT_ENABLED_SITE_ID = 109;

  constructor(private readonly prisma: PrismaService) {}

  async findAvailableDates(
    filters: FindAvailableAppointmentDatesFilters,
  ): Promise<AvailableAppointmentDateCandidate[]> {
    const rows = await this.prisma.$queryRaw<Array<{ dateIso: string | null }>>(Prisma.sql`
      SELECT DISTINCT
        DATE_FORMAT(a.fecha_cita, '%Y-%m-%d') AS dateIso
      FROM agenda a
      INNER JOIN especialidad_empleados ee
        ON TRIM(a.idmedico) = TRIM(ee.\`Código_empleado\`)
      WHERE TRIM(COALESCE(a.Estado, '')) = 'Sin asignar'
        AND TRIM(COALESCE(a.idusuario, '')) = '0000'
        AND a.IdSede = ${PrismaLegacyAppointmentAvailabilityRepository.BOT_ENABLED_SITE_ID}
        AND UPPER(TRIM(COALESCE(ee.bot, ''))) = 'SI'
        AND TRIM(COALESCE(ee.Cups, '')) = ${filters.specialtyCups}
        AND STR_TO_DATE(TRIM(COALESCE(a.idhora, '')), '%H:%i') IS NOT NULL
        AND (
          a.fecha_cita > STR_TO_DATE(${filters.cutoffDateIso}, '%Y-%m-%d')
          OR (
            a.fecha_cita = STR_TO_DATE(${filters.cutoffDateIso}, '%Y-%m-%d')
            AND STR_TO_DATE(TRIM(a.idhora), '%H:%i')
              >= STR_TO_DATE(${filters.cutoffTimeHHmm}, '%H:%i')
          )
        )
      ORDER BY dateIso ASC
    `);

    return rows
      .map((row) => row.dateIso?.trim() ?? '')
      .filter(Boolean)
      .map((dateIso) => ({ dateIso }));
  }

  async findAvailableTimesByDate(
    filters: FindAvailableAppointmentTimesByDateFilters,
  ): Promise<AvailableAppointmentTimeCandidate[]> {
    const afterTimeHHmmExclusive = filters.afterTimeHHmmExclusive?.trim();
    const afterTimeFilter = afterTimeHHmmExclusive
      ? Prisma.sql`
          AND STR_TO_DATE(TRIM(a.idhora), '%H:%i')
            > STR_TO_DATE(${afterTimeHHmmExclusive}, '%H:%i')
        `
      : Prisma.empty;

    const rows = await this.prisma.$queryRaw<Array<{ slotRef: number | null; timeHHmm: string | null }>>(
      Prisma.sql`
        SELECT
          MIN(a.idagenda) AS slotRef,
          DATE_FORMAT(STR_TO_DATE(TRIM(a.idhora), '%H:%i'), '%H:%i') AS timeHHmm
        FROM agenda a
        INNER JOIN especialidad_empleados ee
          ON TRIM(a.idmedico) = TRIM(ee.\`Código_empleado\`)
        WHERE TRIM(COALESCE(a.Estado, '')) = 'Sin asignar'
          AND TRIM(COALESCE(a.idusuario, '')) = '0000'
          AND a.IdSede = ${PrismaLegacyAppointmentAvailabilityRepository.BOT_ENABLED_SITE_ID}
          AND UPPER(TRIM(COALESCE(ee.bot, ''))) = 'SI'
          AND TRIM(COALESCE(ee.Cups, '')) = ${filters.specialtyCups}
          AND a.fecha_cita = STR_TO_DATE(${filters.dateIso}, '%Y-%m-%d')
          AND STR_TO_DATE(TRIM(COALESCE(a.idhora, '')), '%H:%i') IS NOT NULL
          AND STR_TO_DATE(TRIM(a.idhora), '%H:%i')
            >= STR_TO_DATE(${filters.minimumTimeHHmm}, '%H:%i')
          ${afterTimeFilter}
        GROUP BY DATE_FORMAT(STR_TO_DATE(TRIM(a.idhora), '%H:%i'), '%H:%i')
        ORDER BY
          STR_TO_DATE(timeHHmm, '%H:%i') ASC
        LIMIT ${filters.maxResults}
      `,
    );

    return rows
      .map((row) => ({
        slotRef: row.slotRef === null ? '' : String(row.slotRef),
        timeHHmm: row.timeHHmm?.trim() ?? '',
      }))
      .filter((row) => row.slotRef.length > 0 && row.timeHHmm.length > 0);
  }
}
