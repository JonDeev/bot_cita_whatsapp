import { Injectable, OnModuleDestroy } from '@nestjs/common';
import mariadb, { type Pool } from 'mariadb';
import type {
  MarkPatientPhoneVerifiedCommand,
  MarkPatientPhoneVerifiedPersistenceResult,
  MarkPatientPhoneVerifiedRepository,
} from '../../../domain/ports/mark-patient-phone-verified.repository';
import type {
  UpdatePatientContactDetailsCommand,
  UpdatePatientContactDetailsPersistenceResult,
  UpdatePatientContactDetailsRepository,
} from '../../../domain/ports/update-patient-contact-details.repository';

interface UpdateAssignment {
  columnName: string;
  value: string | Date;
}

type ContactColumnLogicalName =
  | 'PRIMARY_PHONE'
  | 'SECONDARY_PHONE'
  | 'PRIMARY_EMAIL'
  | 'SECONDARY_EMAIL'
  | 'PHONE_VERIFIED_AT'
  | 'EMAIL_VERIFIED_AT';

const COLUMN_CANDIDATES: Record<ContactColumnLogicalName, string[]> = {
  PRIMARY_PHONE: ['Teléfono', 'Telefono', 'Tel_fono'],
  SECONDARY_PHONE: [
    'Telefono Secundario',
    'Teléfono Secundario',
    'Telefono_Secundario',
  ],
  PRIMARY_EMAIL: ['email'],
  SECONDARY_EMAIL: ['CorreoElectrónico', 'CorreoElectronico', 'CorreoElectr_nico'],
  PHONE_VERIFIED_AT: ['telefono_verificado_en'],
  EMAIL_VERIFIED_AT: ['correo_verificado_en'],
};

@Injectable()
export class MariadbLegacyPatientContactDetailsRepository
  implements
    UpdatePatientContactDetailsRepository,
    MarkPatientPhoneVerifiedRepository,
    OnModuleDestroy
{
  private pool: Pool | null = null;
  private availableColumnsCache: Set<string> | null = null;

  async updatePatientContactDetails(
    command: UpdatePatientContactDetailsCommand,
  ): Promise<UpdatePatientContactDetailsPersistenceResult> {
    if (!this.isLegacyContactWriteEnabled()) {
      return 'WRITE_DISABLED';
    }

    const connection = await this.getPool().getConnection();
    try {
      const availableColumns = await this.resolveAvailableColumns(connection);
      const assignments = this.buildAssignments(command, availableColumns);

      if (assignments.length === 0) {
        return 'PATIENT_NOT_FOUND';
      }

      const updateClause = assignments
        .map(
          (assignment) => `${this.escapeIdentifier(assignment.columnName)} = ?`,
        )
        .join(', ');
      const sql = `UPDATE ${this.escapeIdentifier('usuarios')} SET ${updateClause} WHERE ${this.escapeIdentifier('IdUsuario')} = ? LIMIT 1`;
      const params = [
        ...assignments.map((assignment) => assignment.value),
        command.patientId,
      ];

      const result = await connection.query<{
        affectedRows: number;
      }>(sql, params);
      const affectedRows =
        typeof result.affectedRows === 'number' ? result.affectedRows : 0;
      if (affectedRows === 0) {
        return 'PATIENT_NOT_FOUND';
      }

      return 'UPDATED';
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

  async markPatientPhoneVerified(
    command: MarkPatientPhoneVerifiedCommand,
  ): Promise<MarkPatientPhoneVerifiedPersistenceResult> {
    if (!this.isLegacyContactWriteEnabled()) {
      return 'WRITE_DISABLED';
    }

    const connection = await this.getPool().getConnection();
    try {
      const availableColumns = await this.resolveAvailableColumns(connection);
      const phoneVerifiedAtColumn = this.findExistingColumn(
        availableColumns,
        COLUMN_CANDIDATES.PHONE_VERIFIED_AT,
      );
      if (!phoneVerifiedAtColumn) {
        throw new Error(
          '[CONTACT_SCHEMA_MISMATCH] Missing phone verification column in usuarios.',
        );
      }

      const verifiedAt = new Date(
        command.verifiedAtIso ?? new Date().toISOString(),
      );
      const sql = `UPDATE ${this.escapeIdentifier('usuarios')} SET ${this.escapeIdentifier(phoneVerifiedAtColumn)} = ? WHERE ${this.escapeIdentifier('IdUsuario')} = ? LIMIT 1`;
      const result = await connection.query<{
        affectedRows: number;
      }>(sql, [verifiedAt, command.patientId]);
      const affectedRows =
        typeof result.affectedRows === 'number' ? result.affectedRows : 0;
      if (affectedRows === 0) {
        return 'PATIENT_NOT_FOUND';
      }

      return 'UPDATED';
    } finally {
      await connection.release();
    }
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
        '[DB_GUARDRAIL] MISSING_WRITE_CONFIGURATION: SISM_CONTACT_WRITE_DATABASE_URL is required for contact updates.',
      );
    }

    this.pool = mariadb.createPool(
      this.normalizeConnectionStringForMariadb(connectionString),
    );
    return this.pool;
  }

  private buildAssignments(
    command: UpdatePatientContactDetailsCommand,
    availableColumns: Set<string>,
  ): UpdateAssignment[] {
    const assignments: UpdateAssignment[] = [];
    const primaryPhoneColumn = this.findExistingColumn(
      availableColumns,
      COLUMN_CANDIDATES.PRIMARY_PHONE,
    );
    const secondaryPhoneColumn = this.findExistingColumn(
      availableColumns,
      COLUMN_CANDIDATES.SECONDARY_PHONE,
    );
    const primaryEmailColumn = this.findExistingColumn(
      availableColumns,
      COLUMN_CANDIDATES.PRIMARY_EMAIL,
    );
    const secondaryEmailColumn = this.findExistingColumn(
      availableColumns,
      COLUMN_CANDIDATES.SECONDARY_EMAIL,
    );
    const phoneVerifiedAtColumn = this.findExistingColumn(
      availableColumns,
      COLUMN_CANDIDATES.PHONE_VERIFIED_AT,
    );
    const emailVerifiedAtColumn = this.findExistingColumn(
      availableColumns,
      COLUMN_CANDIDATES.EMAIL_VERIFIED_AT,
    );
    // Use a real Date so the MariaDB driver serializes it using the DB-safe format.
    const verifiedAt = new Date();

    if (command.nextPrimaryPhone) {
      if (!primaryPhoneColumn) {
        throw new Error(
          '[CONTACT_SCHEMA_MISMATCH] Missing primary phone column in usuarios.',
        );
      }
      assignments.push({
        columnName: primaryPhoneColumn,
        value: command.nextPrimaryPhone,
      });
    }

    if (command.phoneBackupToSecondary && secondaryPhoneColumn) {
      assignments.push({
        columnName: secondaryPhoneColumn,
        value: command.phoneBackupToSecondary,
      });
    }

    if (command.nextPrimaryEmail) {
      if (!primaryEmailColumn) {
        throw new Error(
          '[CONTACT_SCHEMA_MISMATCH] Missing primary email column in usuarios.',
        );
      }
      assignments.push({
        columnName: primaryEmailColumn,
        value: command.nextPrimaryEmail,
      });
    }

    if (command.emailBackupToSecondary && secondaryEmailColumn) {
      assignments.push({
        columnName: secondaryEmailColumn,
        value: command.emailBackupToSecondary,
      });
    }

    if (command.nextPrimaryPhone && phoneVerifiedAtColumn) {
      assignments.push({
        columnName: phoneVerifiedAtColumn,
        value: verifiedAt,
      });
    }

    if (command.nextPrimaryEmail && emailVerifiedAtColumn) {
      assignments.push({
        columnName: emailVerifiedAtColumn,
        value: verifiedAt,
      });
    }

    return assignments;
  }

  private async resolveAvailableColumns(
    connection: Awaited<ReturnType<Pool['getConnection']>>,
  ): Promise<Set<string>> {
    if (this.availableColumnsCache) {
      return this.availableColumnsCache;
    }

    const rows = await connection.query<Array<{ COLUMN_NAME: string }>>(
      `SELECT COLUMN_NAME
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = ?`,
      ['usuarios'],
    );

    this.availableColumnsCache = new Set(
      rows
        .map((row) => row.COLUMN_NAME)
        .filter(
          (columnName) =>
            typeof columnName === 'string' && columnName.length > 0,
        ),
    );

    return this.availableColumnsCache;
  }

  private findExistingColumn(
    availableColumns: Set<string>,
    candidates: string[],
  ): string | null {
    for (const candidate of candidates) {
      if (availableColumns.has(candidate)) {
        return candidate;
      }
    }

    return null;
  }

  private escapeIdentifier(identifier: string): string {
    return `\`${identifier.replace(/`/g, '``')}\``;
  }

  private normalizeConnectionStringForMariadb(connectionString: string): string {
    const normalized = connectionString.trim();
    if (normalized.startsWith('mysql://')) {
      return `mariadb://${normalized.slice('mysql://'.length)}`;
    }

    return normalized;
  }
}
