import { Prisma } from '@prisma/client';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../../shared/infrastructure/prisma/prisma.service';
import type {
  AssignedDispensaryRecord,
  PatientAssignedDispensaryRepository,
} from '../../../domain/ports/patient-assigned-dispensary.repository';

@Injectable()
export class PrismaLegacyPatientAssignedDispensaryRepository implements PatientAssignedDispensaryRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAssignedDispensaryByPatientId(
    patientId: number,
  ): Promise<AssignedDispensaryRecord | null> {
    const rows = await this.prisma.$queryRaw<
      Array<{
        patientId: number | null;
        firstName: string | null;
        secondName: string | null;
        firstLastName: string | null;
        secondLastName: string | null;
        dispensaryId: number | null;
        dispensaryName: string | null;
        dispensaryAddress: string | null;
        dispensaryCity: string | null;
        dispensarySchedule: string | null;
      }>
    >(Prisma.sql`
      SELECT
        u.IdUsuario AS patientId,
        u.Primer_nombre AS firstName,
        u.Segundo_nombre AS secondName,
        u.Primer_apellido AS firstLastName,
        u.Segundo_apellido AS secondLastName,
        d.id_dispensario AS dispensaryId,
        d.nom_dispensario AS dispensaryName,
        d.dir_dispensario AS dispensaryAddress,
        d.ciudad AS dispensaryCity,
        d.hor_atencion AS dispensarySchedule
      FROM usuarios u
      INNER JOIN dispensario d
        ON d.id_dispensario = CAST(TRIM(u.nombre_disp_asignado) AS UNSIGNED)
      WHERE u.IdUsuario = ${patientId}
      LIMIT 1
    `);

    const row = rows[0];
    if (!row) {
      return null;
    }

    const normalizedPatientId = this.normalizePositiveInteger(row.patientId);
    const normalizedDispensaryId = this.normalizePositiveInteger(
      row.dispensaryId,
    );
    if (!normalizedPatientId || !normalizedDispensaryId) {
      return null;
    }

    const firstName = this.normalizeRequiredString(row.firstName);
    const firstLastName = this.normalizeRequiredString(row.firstLastName);
    const dispensaryName = this.normalizeRequiredString(row.dispensaryName);
    const dispensaryAddress = this.normalizeRequiredString(
      row.dispensaryAddress,
    );
    const dispensaryCity = this.normalizeRequiredString(row.dispensaryCity);
    const dispensarySchedule = this.normalizeRequiredString(
      row.dispensarySchedule,
    );

    if (
      !firstName ||
      !firstLastName ||
      !dispensaryName ||
      !dispensaryAddress ||
      !dispensaryCity ||
      !dispensarySchedule
    ) {
      return null;
    }

    return {
      patientId: normalizedPatientId,
      firstName,
      secondName: this.normalizeOptionalString(row.secondName),
      firstLastName,
      secondLastName: this.normalizeOptionalString(row.secondLastName),
      dispensaryId: normalizedDispensaryId,
      dispensaryName,
      dispensaryAddress,
      dispensaryCity,
      dispensarySchedule,
    };
  }

  async findPatientFullNameById(patientId: number): Promise<string | null> {
    const rows = await this.prisma.$queryRaw<
      Array<{
        firstName: string | null;
        secondName: string | null;
        firstLastName: string | null;
        secondLastName: string | null;
      }>
    >(Prisma.sql`
      SELECT
        u.Primer_nombre AS firstName,
        u.Segundo_nombre AS secondName,
        u.Primer_apellido AS firstLastName,
        u.Segundo_apellido AS secondLastName
      FROM usuarios u
      WHERE u.IdUsuario = ${patientId}
      LIMIT 1
    `);

    const row = rows[0];
    if (!row) {
      return null;
    }

    const fullName = [
      this.normalizeRequiredString(row.firstName),
      this.normalizeOptionalString(row.secondName),
      this.normalizeRequiredString(row.firstLastName),
      this.normalizeOptionalString(row.secondLastName),
    ]
      .filter((part) => part && part.length > 0)
      .join(' ')
      .trim();

    return fullName || null;
  }

  private normalizePositiveInteger(value: number | null): number | null {
    if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
      return null;
    }

    return value;
  }

  private normalizeRequiredString(value: string | null): string {
    return value?.trim() ?? '';
  }

  private normalizeOptionalString(value: string | null): string | null {
    const normalized = value?.trim() ?? '';
    return normalized.length > 0 ? normalized : null;
  }
}
