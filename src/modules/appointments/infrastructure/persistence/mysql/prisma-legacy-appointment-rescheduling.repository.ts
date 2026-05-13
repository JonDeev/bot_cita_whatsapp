import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../../shared/infrastructure/prisma/prisma.service';
import type {
  AppointmentReschedulingRepository,
  RescheduleAssignedFutureAppointmentByPatientCommand,
  RescheduleAssignedFutureAppointmentByPatientResult,
} from '../../../domain/ports/appointment-rescheduling.repository';

class OriginalSlotNoLongerRebookableError extends Error {}

@Injectable()
export class PrismaLegacyAppointmentReschedulingRepository implements AppointmentReschedulingRepository {
  constructor(private readonly prisma: PrismaService) {}

  async rescheduleAssignedFutureAppointmentByPatient(
    command: RescheduleAssignedFutureAppointmentByPatientCommand,
  ): Promise<RescheduleAssignedFutureAppointmentByPatientResult> {
    const originalSlotId = this.parseSlotRef(command.originalSlotRef);
    const preferredNewSlotId = this.parseSlotRef(command.preferredNewSlotRef);
    if (originalSlotId === null) {
      return { status: 'ORIGINAL_APPOINTMENT_NOT_REBOOKABLE' };
    }
    if (preferredNewSlotId === null) {
      return { status: 'TIME_NO_LONGER_AVAILABLE' };
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const originalIsRebookable = await this.isOriginalSlotRebookable(
          tx,
          originalSlotId,
          command,
        );
        if (!originalIsRebookable) {
          return { status: 'ORIGINAL_APPOINTMENT_NOT_REBOOKABLE' };
        }

        const wasPreferredAssigned = await this.assignSlotIfAvailable(
          tx,
          preferredNewSlotId,
          command,
        );

        if (wasPreferredAssigned) {
          await this.releaseOriginalSlotOrFail(tx, originalSlotId, command);
          return {
            status: 'RESCHEDULED',
            assignedSlotRef: String(preferredNewSlotId),
            usedFallbackSlot: false,
          };
        }

        if (command.doctorEmployeeCode) {
          return { status: 'TIME_NO_LONGER_AVAILABLE' };
        }

        const fallbackSlotId = await this.findFallbackSlotId(
          tx,
          preferredNewSlotId,
          command,
        );
        if (fallbackSlotId === null) {
          return { status: 'TIME_NO_LONGER_AVAILABLE' };
        }

        const wasFallbackAssigned = await this.assignSlotIfAvailable(
          tx,
          fallbackSlotId,
          command,
        );
        if (!wasFallbackAssigned) {
          return { status: 'TIME_NO_LONGER_AVAILABLE' };
        }

        await this.releaseOriginalSlotOrFail(tx, originalSlotId, command);
        return {
          status: 'RESCHEDULED',
          assignedSlotRef: String(fallbackSlotId),
          usedFallbackSlot: true,
        };
      });
    } catch (error) {
      if (error instanceof OriginalSlotNoLongerRebookableError) {
        return { status: 'ORIGINAL_APPOINTMENT_NOT_REBOOKABLE' };
      }

      throw error;
    }
  }

  private async isOriginalSlotRebookable(
    tx: Prisma.TransactionClient,
    originalSlotId: number,
    command: RescheduleAssignedFutureAppointmentByPatientCommand,
  ): Promise<boolean> {
    const rows = await tx.$queryRaw<
      Array<{ slotRef: number | null }>
    >(Prisma.sql`
      SELECT a.idagenda AS slotRef
      FROM agenda a
      WHERE a.idagenda = ${originalSlotId}
        AND TRIM(COALESCE(a.Estado, '')) = 'Asignada'
        AND TRIM(COALESCE(a.idusuario, '')) = ${command.patientUserId}
        AND STR_TO_DATE(TRIM(COALESCE(a.idhora, '')), '%H:%i') IS NOT NULL
        AND (
          a.fecha_cita > STR_TO_DATE(${command.currentDateIso}, '%Y-%m-%d')
          OR (
            a.fecha_cita = STR_TO_DATE(${command.currentDateIso}, '%Y-%m-%d')
            AND STR_TO_DATE(TRIM(a.idhora), '%H:%i')
              > STR_TO_DATE(${command.currentTimeHHmm}, '%H:%i')
          )
        )
      LIMIT 1
      FOR UPDATE
    `);

    return rows.length > 0;
  }

  private async assignSlotIfAvailable(
    tx: Prisma.TransactionClient,
    slotId: number,
    command: RescheduleAssignedFutureAppointmentByPatientCommand,
  ): Promise<boolean> {
    const affectedRows = await tx.$executeRaw(Prisma.sql`
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

  private async findFallbackSlotId(
    tx: Prisma.TransactionClient,
    excludedSlotId: number,
    command: RescheduleAssignedFutureAppointmentByPatientCommand,
  ): Promise<number | null> {
    const rows = await tx.$queryRaw<
      Array<{ slotRef: number | null }>
    >(Prisma.sql`
      SELECT a.idagenda AS slotRef
      FROM agenda a
      INNER JOIN especialidad_empleados ee
        ON TRIM(a.idmedico) = TRIM(ee.\`Código_empleado\`)
      WHERE a.IdSede = ${command.requiredSiteId}
        AND TRIM(COALESCE(a.Estado, '')) = 'Sin asignar'
        AND TRIM(COALESCE(a.idusuario, '')) = '0000'
        AND UPPER(TRIM(COALESCE(ee.bot, ''))) = 'SI'
        AND TRIM(COALESCE(ee.Cups, '')) = ${command.specialtyCups}
        AND a.fecha_cita = STR_TO_DATE(${command.appointmentDateIso}, '%Y-%m-%d')
        AND STR_TO_DATE(TRIM(COALESCE(a.idhora, '')), '%H:%i') IS NOT NULL
        AND DATE_FORMAT(STR_TO_DATE(TRIM(a.idhora), '%H:%i'), '%H:%i') = ${command.appointmentTimeHHmm}
        AND a.idagenda <> ${excludedSlotId}
      ORDER BY a.idagenda ASC
      LIMIT 1
      FOR UPDATE
    `);

    const slotRef = rows.at(0)?.slotRef;
    if (slotRef === null || slotRef === undefined) {
      return null;
    }

    return slotRef;
  }

  private async releaseOriginalSlotOrFail(
    tx: Prisma.TransactionClient,
    originalSlotId: number,
    command: RescheduleAssignedFutureAppointmentByPatientCommand,
  ): Promise<void> {
    const affectedRows = await tx.$executeRaw(Prisma.sql`
      UPDATE agenda
      SET
        idusuario = '0000',
        AsignadaPor = NULL,
        fecha_solicitud = NULL,
        Telefono = NULL,
        MedioSolicitud = NULL,
        Estado = 'Sin asignar',
        fecha_cancelada = STR_TO_DATE(${command.canceledDateIso}, '%Y-%m-%d'),
        motivo = 'CANCELADA POR EL PACIENTE DESDE EL BOT',
        cancelada_por = 'BOT',
        paciente_cancelada = ${command.patientUserId}
      WHERE idagenda = ${originalSlotId}
        AND TRIM(COALESCE(Estado, '')) = 'Asignada'
        AND TRIM(COALESCE(idusuario, '')) = ${command.patientUserId}
        AND (
          fecha_cita > STR_TO_DATE(${command.currentDateIso}, '%Y-%m-%d')
          OR (
            fecha_cita = STR_TO_DATE(${command.currentDateIso}, '%Y-%m-%d')
            AND STR_TO_DATE(TRIM(COALESCE(idhora, '')), '%H:%i')
              > STR_TO_DATE(${command.currentTimeHHmm}, '%H:%i')
          )
        )
    `);

    if (affectedRows <= 0) {
      throw new OriginalSlotNoLongerRebookableError(
        'The original appointment slot can no longer be released.',
      );
    }
  }

  private parseSlotRef(slotRef: string | undefined): number | null {
    const parsed = Number.parseInt(slotRef?.trim() ?? '', 10);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      return null;
    }

    return parsed;
  }
}
