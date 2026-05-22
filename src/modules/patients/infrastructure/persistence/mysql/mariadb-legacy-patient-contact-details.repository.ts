import { Injectable, OnModuleDestroy } from '@nestjs/common';
import mariadb, { type Pool } from 'mariadb';
import type {
  UpdatePatientContactDetailsCommand,
  UpdatePatientContactDetailsPersistenceResult,
  UpdatePatientContactDetailsRepository,
} from '../../../domain/ports/update-patient-contact-details.repository';

interface UpdateAssignment {
  columnName: string;
  value: string;
}

type ContactColumnLogicalName =
  | 'PRIMARY_PHONE'
  | 'SECONDARY_PHONE'
  | 'PRIMARY_EMAIL'
  | 'SECONDARY_EMAIL'
  | 'CONFIRMATION_FLAG';

const COLUMN_CANDIDATES: Record<ContactColumnLogicalName, string[]> = {
  PRIMARY_PHONE: ['Teléfono', 'Telefono', 'Tel_fono'],
  SECONDARY_PHONE: [
    'Telefono Secundario',
    'Teléfono Secundario',
    'Telefono_Secundario',
  ],
  PRIMARY_EMAIL: ['email'],
  SECONDARY_EMAIL: ['CorreoElectrónico', 'CorreoElectronico', 'CorreoElectr_nico'],
  CONFIRMATION_FLAG: ['confirmacion_telefono'],
};

@Injectable()
export class MariadbLegacyPatientContactDetailsRepository
  implements UpdatePatientContactDetailsRepository, OnModuleDestroy
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
    const confirmationFlagColumn = this.findExistingColumn(
      availableColumns,
      COLUMN_CANDIDATES.CONFIRMATION_FLAG,
    );

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

    if (confirmationFlagColumn) {
      assignments.push({
        columnName: confirmationFlagColumn,
        value: this.resolveConfirmationValue(command.mode),
      });
    }

    return assignments;
  }

  private resolveConfirmationValue(
    mode: UpdatePatientContactDetailsCommand['mode'],
  ): string {
    if (mode === 'PHONE') {
      return 'telefono';
    }

    if (mode === 'EMAIL') {
      return 'correo';
    }

    return 'ambos';
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
