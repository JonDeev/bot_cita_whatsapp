import { Injectable, OnModuleDestroy } from '@nestjs/common';
import mariadb, { type Pool } from 'mariadb';
import type {
  AppointmentReminderPatientContactRepository,
  AppointmentReminderPatientContactWriteResult,
} from '../../../domain/ports/appointment-reminder-patient-contact.repository';

@Injectable()
export class MariadbLegacyAppointmentReminderPatientContactRepository
  implements AppointmentReminderPatientContactRepository, OnModuleDestroy
{
  private pool: Pool | null = null;

  async markPhoneVerified(input: {
    patientLegacyUserId: number;
    verifiedAtIso: string;
  }): Promise<AppointmentReminderPatientContactWriteResult> {
    if (!this.isLegacyContactWriteEnabled()) {
      return 'WRITE_DISABLED';
    }

    const connection = await this.getPool().getConnection();
    try {
      const result = await connection.query<{ affectedRows: number }>(
        `UPDATE \`usuarios\`
         SET \`telefono_verificado_en\` = ?
         WHERE \`IdUsuario\` = ?
         LIMIT 1`,
        [new Date(input.verifiedAtIso), input.patientLegacyUserId],
      );

      return result.affectedRows > 0 ? 'UPDATED' : 'PATIENT_NOT_FOUND';
    } finally {
      await connection.release();
    }
  }

  async clearPhoneAndVerification(input: {
    patientLegacyUserId: number;
  }): Promise<AppointmentReminderPatientContactWriteResult> {
    if (!this.isLegacyContactWriteEnabled()) {
      return 'WRITE_DISABLED';
    }

    const connection = await this.getPool().getConnection();
    try {
      const result = await connection.query<{ affectedRows: number }>(
        `UPDATE \`usuarios\`
         SET \`Teléfono\` = NULL,
             \`telefono_verificado_en\` = NULL
         WHERE \`IdUsuario\` = ?
         LIMIT 1`,
        [input.patientLegacyUserId],
      );

      return result.affectedRows > 0 ? 'UPDATED' : 'PATIENT_NOT_FOUND';
    } finally {
      await connection.release();
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (!this.pool) {
      return;
    }

    await this.pool.end();
    this.pool = null;
  }

  private isLegacyContactWriteEnabled(): boolean {
    return (
      (process.env.ALLOW_LEGACY_PATIENT_CONTACT_WRITE ?? '')
        .trim()
        .toLowerCase() === 'true'
    );
  }

  private getPool(): Pool {
    if (this.pool) {
      return this.pool;
    }

    const connectionString = (
      process.env.SISM_CONTACT_WRITE_DATABASE_URL ?? ''
    ).trim();
    if (!connectionString) {
      throw new Error(
        '[DB_GUARDRAIL] MISSING_WRITE_CONFIGURATION: SISM_CONTACT_WRITE_DATABASE_URL is required for reminder contact writes.',
      );
    }

    this.pool = mariadb.createPool(
      this.normalizeConnectionStringForMariadb(connectionString),
    );
    return this.pool;
  }

  private normalizeConnectionStringForMariadb(connectionString: string): string {
    const normalized = connectionString.trim();
    if (normalized.startsWith('mysql://')) {
      return `mariadb://${normalized.slice('mysql://'.length)}`;
    }

    return normalized;
  }
}
