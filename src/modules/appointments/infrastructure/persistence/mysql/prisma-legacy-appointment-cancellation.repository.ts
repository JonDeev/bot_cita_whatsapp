import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../../shared/infrastructure/prisma/prisma.service';
import type {
  AppointmentCancellationRepository,
  CancelAssignedFutureAppointmentCommand,
} from '../../../domain/ports/appointment-cancellation.repository';

@Injectable()
export class PrismaLegacyAppointmentCancellationRepository
  implements AppointmentCancellationRepository
{
  constructor(private readonly prisma: PrismaService) {}

  async cancelAssignedFutureAppointmentByPatient(
    command: CancelAssignedFutureAppointmentCommand,
  ): Promise<boolean> {
    const slotId = this.parseSlotRef(command.slotRef);
    if (slotId === null) {
      return false;
    }

    const affectedRows = await this.prisma.$executeRaw(Prisma.sql`
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
      WHERE idagenda = ${slotId}
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

    return affectedRows > 0;
  }

  private parseSlotRef(slotRef: string): number | null {
    const parsed = Number.parseInt(slotRef.trim(), 10);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      return null;
    }

    return parsed;
  }
}
