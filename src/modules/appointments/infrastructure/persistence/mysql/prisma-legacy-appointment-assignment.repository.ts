import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../../shared/infrastructure/prisma/prisma.service';
import type {
  AppointmentAssignmentRepository,
  AppointmentSlotCandidate,
  AssignAvailableSlotCommand,
  FindFallbackAvailableSlotFilters,
} from '../../../domain/ports/appointment-assignment.repository';

@Injectable()
export class PrismaLegacyAppointmentAssignmentRepository
  implements AppointmentAssignmentRepository
{
  constructor(private readonly prisma: PrismaService) {}

  async assignSlotIfAvailable(command: AssignAvailableSlotCommand): Promise<boolean> {
    const slotId = this.parseSlotRef(command.slotRef);
    if (slotId === null) {
      return false;
    }

    const affectedRows = await this.prisma.$executeRaw(Prisma.sql`
      UPDATE agenda
      SET
        idusuario = ${command.patientUserId},
        AsignadaPor = 'AdrianaBot',
        fecha_solicitud = STR_TO_DATE(${command.requestDateIso}, '%Y-%m-%d'),
        Estado = 'Asignada',
        MedioSolicitud = 'BOT',
        Telefono = ${command.patientPhone}
      WHERE idagenda = ${slotId}
        AND IdSede = ${command.requiredSiteId}
        AND TRIM(COALESCE(Estado, '')) = 'Sin asignar'
        AND TRIM(COALESCE(idusuario, '')) = '0000'
    `);

    return affectedRows > 0;
  }

  async findFallbackAvailableSlot(
    filters: FindFallbackAvailableSlotFilters,
  ): Promise<AppointmentSlotCandidate | null> {
    const excludedSlotId = this.parseSlotRef(filters.excludeSlotRef);
    const excludeCondition =
      excludedSlotId === null ? Prisma.empty : Prisma.sql`AND a.idagenda <> ${excludedSlotId}`;

    const rows = await this.prisma.$queryRaw<Array<{ slotRef: number | null }>>(Prisma.sql`
      SELECT a.idagenda AS slotRef
      FROM agenda a
      INNER JOIN especialidad_empleados ee
        ON TRIM(a.idmedico) = TRIM(ee.\`Código_empleado\`)
      WHERE a.IdSede = ${filters.requiredSiteId}
        AND TRIM(COALESCE(a.Estado, '')) = 'Sin asignar'
        AND TRIM(COALESCE(a.idusuario, '')) = '0000'
        AND UPPER(TRIM(COALESCE(ee.bot, ''))) = 'SI'
        AND TRIM(COALESCE(ee.Cups, '')) = ${filters.specialtyCups}
        AND a.fecha_cita = STR_TO_DATE(${filters.appointmentDateIso}, '%Y-%m-%d')
        AND STR_TO_DATE(TRIM(COALESCE(a.idhora, '')), '%H:%i') IS NOT NULL
        AND DATE_FORMAT(STR_TO_DATE(TRIM(a.idhora), '%H:%i'), '%H:%i') = ${filters.appointmentTimeHHmm}
        ${excludeCondition}
      ORDER BY a.idagenda ASC
      LIMIT 1
    `);

    const slotRef = rows.at(0)?.slotRef;
    if (slotRef === null || slotRef === undefined) {
      return null;
    }

    return { slotRef: String(slotRef) };
  }

  private parseSlotRef(slotRef: string | undefined): number | null {
    const parsed = Number.parseInt(slotRef?.trim() ?? '', 10);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      return null;
    }

    return parsed;
  }
}
