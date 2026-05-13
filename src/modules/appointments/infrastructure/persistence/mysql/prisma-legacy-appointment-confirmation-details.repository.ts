import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../../shared/infrastructure/prisma/prisma.service';
import type {
  AppointmentConfirmationDetailsRepository,
  AssignedAppointmentConfirmationDetails,
  PatientAppointmentConfirmationDetails,
} from '../../../domain/ports/appointment-confirmation-details.repository';

@Injectable()
export class PrismaLegacyAppointmentConfirmationDetailsRepository implements AppointmentConfirmationDetailsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findPatientById(
    patientId: number,
  ): Promise<PatientAppointmentConfirmationDetails | null> {
    const patient = await this.prisma.usuarios.findUnique({
      where: {
        IdUsuario: patientId,
      },
      select: {
        IdUsuario: true,
        Primer_nombre: true,
        Segundo_nombre: true,
        Primer_apellido: true,
        Segundo_apellido: true,
        Tel_fono: true,
      },
    });

    if (!patient) {
      return null;
    }

    return {
      userId: patient.IdUsuario,
      firstName: patient.Primer_nombre,
      secondName: patient.Segundo_nombre ?? null,
      firstLastName: patient.Primer_apellido,
      secondLastName: patient.Segundo_apellido ?? null,
      phone: patient.Tel_fono ?? null,
    };
  }

  async findAssignedAppointmentBySlotRef(
    slotRef: string,
  ): Promise<AssignedAppointmentConfirmationDetails | null> {
    const slotId = this.parseSlotRef(slotRef);
    if (slotId === null) {
      return null;
    }

    const rows = await this.prisma.$queryRaw<
      Array<{
        slotRef: number | null;
        appointmentDateIso: string | null;
        appointmentTimeHHmm: string | null;
        professionalName: string | null;
        siteName: string | null;
        siteAddress: string | null;
      }>
    >(Prisma.sql`
      SELECT
        a.idagenda AS slotRef,
        DATE_FORMAT(a.fecha_cita, '%Y-%m-%d') AS appointmentDateIso,
        DATE_FORMAT(STR_TO_DATE(TRIM(COALESCE(a.idhora, '')), '%H:%i'), '%H:%i') AS appointmentTimeHHmm,
        e.Nombre_empleado AS professionalName,
        s.Sede AS siteName,
        s.Direccion AS siteAddress
      FROM agenda a
      LEFT JOIN empleados e
        ON TRIM(a.idmedico) = TRIM(e.\`Código_empleado\`)
      LEFT JOIN sedes s
        ON a.IdSede = s.IdSede
      WHERE a.idagenda = ${slotId}
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
      professionalName: row.professionalName?.trim() ?? null,
      siteName: row.siteName?.trim() ?? null,
      siteAddress: row.siteAddress?.trim() ?? null,
    };
  }

  private parseSlotRef(slotRef: string): number | null {
    const parsed = Number.parseInt(slotRef.trim(), 10);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      return null;
    }

    return parsed;
  }
}
