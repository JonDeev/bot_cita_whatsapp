import { Injectable } from '@nestjs/common';
import { Prisma } from '@whatsapp-bot/prisma-client';
import { PrismaBotService } from '../../../../../shared/infrastructure/prisma-bot/prisma-bot.service';
import type {
  ListSatisfactionSurveyRuntimeSettingEventsInput,
  SatisfactionSurveyRuntimeSettingsRepository,
  SaveSatisfactionSurveyRuntimeSettingsCommand,
  SaveSatisfactionSurveyRuntimeSettingsResult,
} from '../../../domain/ports/satisfaction-survey-runtime-settings.repository';
import type {
  SatisfactionSurveyRuntimeSettingChangeType,
  SatisfactionSurveyRuntimeSettingEventRecord,
  SatisfactionSurveyRuntimeSettingsRecord,
  SatisfactionSurveyRuntimeSettingsSnapshot,
} from '../../../domain/satisfaction-survey-runtime.types';

type RuntimeDbClient = {
  $queryRaw<T = unknown>(query: Prisma.Sql): Promise<T>;
  $executeRaw(query: Prisma.Sql): Promise<number>;
};

interface RuntimeSettingsRow {
  id: number;
  scopeKey: string;
  sendMode: SatisfactionSurveyRuntimeSettingsSnapshot['sendMode'];
  sendRolloutPercent: number;
  emergencyPauseEnabled: boolean;
  dispatchEnabled: boolean;
  eligibilityLimit: number;
  expirationHours: number;
  scheduleProfile: SatisfactionSurveyRuntimeSettingsSnapshot['scheduleProfile'];
  schedulerLoopEnabled: boolean;
  tickIntervalMs: number;
  slotLockTtlSeconds: number;
  maxDispatchesPerRun: number;
  version: number;
  updatedByAdminUserId: number | null;
  updatedAt: Date | string;
  createdAt: Date | string;
}

interface RuntimeSettingEventRow {
  id: number;
  settingsVersion: number;
  adminUserId: number | null;
  actorDisplayName: string | null;
  actorUsername: string | null;
  changeType: SatisfactionSurveyRuntimeSettingChangeType | string;
  section: SatisfactionSurveyRuntimeSettingEventRecord['section'] | string;
  reason: string | null;
  previousSnapshotJson: Prisma.JsonValue;
  newSnapshotJson: Prisma.JsonValue;
  effectiveSnapshotJson: Prisma.JsonValue;
  occurredAt: Date | string;
  createdAt: Date | string;
}

interface RuntimeSettingsWithIdRow extends RuntimeSettingsRow {
  id: number;
}

const SETTINGS_SELECT_FIELDS = Prisma.sql`
  id,
  scope_key AS scopeKey,
  send_mode AS sendMode,
  send_rollout_percent AS sendRolloutPercent,
  emergency_pause_enabled AS emergencyPauseEnabled,
  dispatch_enabled AS dispatchEnabled,
  eligibility_limit AS eligibilityLimit,
  expiration_hours AS expirationHours,
  schedule_profile AS scheduleProfile,
  scheduler_loop_enabled AS schedulerLoopEnabled,
  tick_interval_ms AS tickIntervalMs,
  slot_lock_ttl_seconds AS slotLockTtlSeconds,
  max_dispatches_per_run AS maxDispatchesPerRun,
  version,
  updated_by_admin_user_id AS updatedByAdminUserId,
  updated_at AS updatedAt,
  created_at AS createdAt
`;

const EVENT_SELECT_FIELDS = Prisma.sql`
  e.id AS id,
  e.settings_version AS settingsVersion,
  e.admin_user_id AS adminUserId,
  a.display_name AS actorDisplayName,
  a.username AS actorUsername,
  e.change_type AS changeType,
  e.section AS section,
  e.reason AS reason,
  e.previous_snapshot_json AS previousSnapshotJson,
  e.new_snapshot_json AS newSnapshotJson,
  e.effective_snapshot_json AS effectiveSnapshotJson,
  e.occurred_at AS occurredAt,
  e.created_at AS createdAt
`;

@Injectable()
export class PrismaBotSatisfactionSurveyRuntimeSettingsRepository
  implements SatisfactionSurveyRuntimeSettingsRepository
{
  constructor(private readonly prismaBot: PrismaBotService) {}

  async findByScope(
    scopeKey: string,
  ): Promise<SatisfactionSurveyRuntimeSettingsRecord | null> {
    const rows = await this.prismaBot.$queryRaw<RuntimeSettingsRow[]>(
      Prisma.sql`
        SELECT ${SETTINGS_SELECT_FIELDS}
        FROM bot_satisfaction_survey_runtime_settings
        WHERE scope_key = ${scopeKey}
        LIMIT 1
      `,
    );

    return rows[0] ? this.mapSettings(rows[0]) : null;
  }

  async listEvents(
    input: ListSatisfactionSurveyRuntimeSettingEventsInput,
  ): Promise<SatisfactionSurveyRuntimeSettingEventRecord[]> {
    const rows = await this.prismaBot.$queryRaw<RuntimeSettingEventRow[]>(
      Prisma.sql`
        SELECT ${EVENT_SELECT_FIELDS}
        FROM bot_satisfaction_survey_runtime_setting_events e
        LEFT JOIN bot_admin_users a ON a.id = e.admin_user_id
        ORDER BY e.occurred_at DESC, e.id DESC
        LIMIT ${input.limit}
      `,
    );

    return rows.map((row) => this.mapEvent(row));
  }

  async findLatestEventByChangeTypes(input: {
    changeTypes: readonly SatisfactionSurveyRuntimeSettingChangeType[];
  }): Promise<SatisfactionSurveyRuntimeSettingEventRecord | null> {
    if (input.changeTypes.length === 0) {
      return null;
    }

    const rows = await this.prismaBot.$queryRaw<RuntimeSettingEventRow[]>(
      Prisma.sql`
        SELECT ${EVENT_SELECT_FIELDS}
        FROM bot_satisfaction_survey_runtime_setting_events e
        LEFT JOIN bot_admin_users a ON a.id = e.admin_user_id
        WHERE e.change_type IN (${Prisma.join(input.changeTypes)})
        ORDER BY e.occurred_at DESC, e.id DESC
        LIMIT 1
      `,
    );

    return rows[0] ? this.mapEvent(rows[0]) : null;
  }

  async saveWithEvent(
    command: SaveSatisfactionSurveyRuntimeSettingsCommand,
  ): Promise<SaveSatisfactionSurveyRuntimeSettingsResult | null> {
    return this.prismaBot.$transaction(async (tx) => {
      const existing = await this.findByScopeWithClient(tx, command.scopeKey);

      if (!existing) {
        if (command.expectedVersion !== 0) {
          return null;
        }

        try {
          await tx.$executeRaw(
            Prisma.sql`
              INSERT INTO bot_satisfaction_survey_runtime_settings (
                scope_key,
                send_mode,
                send_rollout_percent,
                emergency_pause_enabled,
                dispatch_enabled,
                eligibility_limit,
                expiration_hours,
                schedule_profile,
                scheduler_loop_enabled,
                tick_interval_ms,
                slot_lock_ttl_seconds,
                max_dispatches_per_run,
                version,
                updated_by_admin_user_id,
                created_at,
                updated_at
              ) VALUES (
                ${command.scopeKey},
                ${command.nextSnapshot.sendMode},
                ${command.nextSnapshot.sendRolloutPercent},
                ${command.nextSnapshot.emergencyPauseEnabled},
                ${command.nextSnapshot.dispatchEnabled},
                ${command.nextSnapshot.eligibilityLimit},
                ${command.nextSnapshot.expirationHours},
                ${command.nextSnapshot.scheduleProfile},
                ${command.nextSnapshot.schedulerLoopEnabled},
                ${command.nextSnapshot.tickIntervalMs},
                ${command.nextSnapshot.slotLockTtlSeconds},
                ${command.nextSnapshot.maxDispatchesPerRun},
                1,
                ${command.adminUserId},
                ${new Date(command.occurredAtIso)},
                ${new Date(command.occurredAtIso)}
              )
            `,
          );
        } catch (error) {
          if (this.isDuplicateKeyError(error)) {
            return null;
          }

          throw error;
        }

        const created = await this.findByScopeWithClient(tx, command.scopeKey);
        if (!created) {
          return null;
        }

        const event = await this.insertEvent(tx, {
          settingsVersion: created.version,
          adminUserId: command.adminUserId,
          changeType: command.changeType,
          section: command.section,
          reason: command.reason,
          previousSnapshotJson: this.snapshotToJson(command.nextSnapshot),
          newSnapshotJson: this.snapshotToJson(command.nextSnapshot),
          effectiveSnapshotJson: this.snapshotToJson(command.effectiveSnapshot),
          occurredAtIso: command.occurredAtIso,
        });

        await this.insertAdminAuditEvent(tx, command);

        return {
          settings: created,
          event,
        };
      }

      if (existing.version !== command.expectedVersion) {
        return null;
      }

      const affectedRows = await tx.$executeRaw(
        Prisma.sql`
          UPDATE bot_satisfaction_survey_runtime_settings
          SET
            send_mode = ${command.nextSnapshot.sendMode},
            send_rollout_percent = ${command.nextSnapshot.sendRolloutPercent},
            emergency_pause_enabled = ${command.nextSnapshot.emergencyPauseEnabled},
            dispatch_enabled = ${command.nextSnapshot.dispatchEnabled},
            eligibility_limit = ${command.nextSnapshot.eligibilityLimit},
            expiration_hours = ${command.nextSnapshot.expirationHours},
            schedule_profile = ${command.nextSnapshot.scheduleProfile},
            scheduler_loop_enabled = ${command.nextSnapshot.schedulerLoopEnabled},
            tick_interval_ms = ${command.nextSnapshot.tickIntervalMs},
            slot_lock_ttl_seconds = ${command.nextSnapshot.slotLockTtlSeconds},
            max_dispatches_per_run = ${command.nextSnapshot.maxDispatchesPerRun},
            version = version + 1,
            updated_by_admin_user_id = ${command.adminUserId},
            updated_at = ${new Date(command.occurredAtIso)}
          WHERE id = ${existing.id} AND version = ${command.expectedVersion}
        `,
      );

      if (affectedRows !== 1) {
        return null;
      }

      const updated = await this.findByIdWithClient(tx, existing.id);
      if (!updated) {
        return null;
      }

      const event = await this.insertEvent(tx, {
        settingsVersion: updated.version,
        adminUserId: command.adminUserId,
        changeType: command.changeType,
        section: command.section,
        reason: command.reason,
        previousSnapshotJson: this.snapshotToJson(existing.snapshot),
        newSnapshotJson: this.snapshotToJson(command.nextSnapshot),
        effectiveSnapshotJson: this.snapshotToJson(command.effectiveSnapshot),
        occurredAtIso: command.occurredAtIso,
      });

      await this.insertAdminAuditEvent(tx, command);

      return {
        settings: updated,
        event,
      };
    });
  }

  private async findByScopeWithClient(
    client: RuntimeDbClient,
    scopeKey: string,
  ): Promise<SatisfactionSurveyRuntimeSettingsRecord | null> {
    const rows = await client.$queryRaw<RuntimeSettingsRow[]>(
      Prisma.sql`
        SELECT ${SETTINGS_SELECT_FIELDS}
        FROM bot_satisfaction_survey_runtime_settings
        WHERE scope_key = ${scopeKey}
        LIMIT 1
      `,
    );

    return rows[0] ? this.mapSettings(rows[0]) : null;
  }

  private async findByIdWithClient(
    client: RuntimeDbClient,
    id: number,
  ): Promise<SatisfactionSurveyRuntimeSettingsRecord | null> {
    const rows = await client.$queryRaw<RuntimeSettingsRow[]>(
      Prisma.sql`
        SELECT ${SETTINGS_SELECT_FIELDS}
        FROM bot_satisfaction_survey_runtime_settings
        WHERE id = ${id}
        LIMIT 1
      `,
    );

    return rows[0] ? this.mapSettings(rows[0]) : null;
  }

  private async insertEvent(
    client: RuntimeDbClient,
    input: {
      settingsVersion: number;
      adminUserId: number | null;
      changeType: SatisfactionSurveyRuntimeSettingChangeType;
      section: SatisfactionSurveyRuntimeSettingEventRecord['section'];
      reason: string | null;
      previousSnapshotJson: Prisma.InputJsonValue;
      newSnapshotJson: Prisma.InputJsonValue;
      effectiveSnapshotJson: Prisma.InputJsonValue;
      occurredAtIso: string;
    },
  ): Promise<SatisfactionSurveyRuntimeSettingEventRecord> {
    await client.$executeRaw(
      Prisma.sql`
        INSERT INTO bot_satisfaction_survey_runtime_setting_events (
          settings_version,
          admin_user_id,
          change_type,
          section,
          reason,
          previous_snapshot_json,
          new_snapshot_json,
          effective_snapshot_json,
          occurred_at,
          created_at
        ) VALUES (
          ${input.settingsVersion},
          ${input.adminUserId},
          ${input.changeType},
          ${input.section},
          ${input.reason},
          ${input.previousSnapshotJson},
          ${input.newSnapshotJson},
          ${input.effectiveSnapshotJson},
          ${new Date(input.occurredAtIso)},
          ${new Date(input.occurredAtIso)}
        )
      `,
    );

    const rows = await client.$queryRaw<RuntimeSettingEventRow[]>(
      Prisma.sql`
        SELECT ${EVENT_SELECT_FIELDS}
        FROM bot_satisfaction_survey_runtime_setting_events e
        LEFT JOIN bot_admin_users a ON a.id = e.admin_user_id
        WHERE e.settings_version = ${input.settingsVersion}
        ORDER BY e.id DESC
        LIMIT 1
      `,
    );

    const row = rows[0];
    if (!row) {
      throw new Error('Unable to read inserted survey runtime event.');
    }

    return this.mapEvent(row);
  }

  private async insertAdminAuditEvent(
    client: RuntimeDbClient,
    command: SaveSatisfactionSurveyRuntimeSettingsCommand,
  ): Promise<void> {
    await client.$executeRaw(
      Prisma.sql`
        INSERT INTO bot_admin_audit_events (
          admin_user_id,
          action,
          resource_type,
          resource_id,
          metadata,
          ip_hash,
          occurred_at,
          created_at
        ) VALUES (
          ${command.adminUserId},
          ${command.adminAudit.action},
          ${command.adminAudit.resourceType},
          ${command.adminAudit.resourceId},
          ${command.adminAudit.metadata},
          ${command.adminAudit.ipHash},
          ${new Date(command.occurredAtIso)},
          ${new Date(command.occurredAtIso)}
        )
      `,
    );
  }

  private mapSettings(
    row: RuntimeSettingsRow,
  ): SatisfactionSurveyRuntimeSettingsRecord {
    return {
      id: row.id,
      scopeKey: row.scopeKey,
      version: row.version,
      snapshot: this.mapSnapshot(row),
      updatedByAdminUserId: row.updatedByAdminUserId,
      updatedAtIso: this.toIso(row.updatedAt),
      createdAtIso: this.toIso(row.createdAt),
    };
  }

  private mapSnapshot(
    row: Pick<
      RuntimeSettingsRow,
      | 'sendMode'
      | 'sendRolloutPercent'
      | 'emergencyPauseEnabled'
      | 'dispatchEnabled'
      | 'eligibilityLimit'
      | 'expirationHours'
      | 'scheduleProfile'
      | 'schedulerLoopEnabled'
      | 'tickIntervalMs'
      | 'slotLockTtlSeconds'
      | 'maxDispatchesPerRun'
    >,
  ): SatisfactionSurveyRuntimeSettingsSnapshot {
    return {
      sendMode: row.sendMode,
      sendRolloutPercent: row.sendRolloutPercent,
      emergencyPauseEnabled: row.emergencyPauseEnabled,
      dispatchEnabled: row.dispatchEnabled,
      eligibilityLimit: row.eligibilityLimit,
      expirationHours: row.expirationHours,
      scheduleProfile: row.scheduleProfile,
      schedulerLoopEnabled: row.schedulerLoopEnabled,
      tickIntervalMs: row.tickIntervalMs,
      slotLockTtlSeconds: row.slotLockTtlSeconds,
      maxDispatchesPerRun: row.maxDispatchesPerRun,
    };
  }

  private mapEvent(
    row: RuntimeSettingEventRow,
  ): SatisfactionSurveyRuntimeSettingEventRecord {
    return {
      id: row.id,
      settingsVersion: row.settingsVersion,
      adminUserId: row.adminUserId,
      actor: {
        displayName: row.actorDisplayName,
        username: row.actorUsername,
      },
      changeType: row.changeType as SatisfactionSurveyRuntimeSettingChangeType,
      section: row.section as SatisfactionSurveyRuntimeSettingEventRecord['section'],
      reason: row.reason,
      previousSnapshot: this.parseSnapshotJson(row.previousSnapshotJson),
      newSnapshot: this.parseSnapshotJson(row.newSnapshotJson),
      effectiveSnapshot: this.parseSnapshotJson(row.effectiveSnapshotJson),
      occurredAtIso: this.toIso(row.occurredAt),
      createdAtIso: this.toIso(row.createdAt),
    };
  }

  private parseSnapshotJson(
    snapshot: Prisma.JsonValue,
  ): SatisfactionSurveyRuntimeSettingsSnapshot {
    const value = snapshot as Record<string, unknown>;

    return {
      sendMode: String(value.sendMode) as SatisfactionSurveyRuntimeSettingsSnapshot['sendMode'],
      sendRolloutPercent: Number(value.sendRolloutPercent),
      emergencyPauseEnabled: Boolean(value.emergencyPauseEnabled),
      dispatchEnabled: Boolean(value.dispatchEnabled),
      eligibilityLimit: Number(value.eligibilityLimit),
      expirationHours: Number(value.expirationHours),
      scheduleProfile: String(value.scheduleProfile) as SatisfactionSurveyRuntimeSettingsSnapshot['scheduleProfile'],
      schedulerLoopEnabled: Boolean(value.schedulerLoopEnabled),
      tickIntervalMs: Number(value.tickIntervalMs),
      slotLockTtlSeconds: Number(value.slotLockTtlSeconds),
      maxDispatchesPerRun: Number(value.maxDispatchesPerRun),
    };
  }

  private snapshotToJson(
    snapshot: SatisfactionSurveyRuntimeSettingsSnapshot,
  ): Prisma.InputJsonValue {
    return {
      sendMode: snapshot.sendMode,
      sendRolloutPercent: snapshot.sendRolloutPercent,
      emergencyPauseEnabled: snapshot.emergencyPauseEnabled,
      dispatchEnabled: snapshot.dispatchEnabled,
      eligibilityLimit: snapshot.eligibilityLimit,
      expirationHours: snapshot.expirationHours,
      scheduleProfile: snapshot.scheduleProfile,
      schedulerLoopEnabled: snapshot.schedulerLoopEnabled,
      tickIntervalMs: snapshot.tickIntervalMs,
      slotLockTtlSeconds: snapshot.slotLockTtlSeconds,
      maxDispatchesPerRun: snapshot.maxDispatchesPerRun,
    };
  }

  private toIso(value: Date | string): string {
    return new Date(value).toISOString();
  }

  private isDuplicateKeyError(error: unknown): boolean {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
      return false;
    }

    if (error.code === 'P2002') {
      return true;
    }

    const meta = error.meta as { code?: string } | undefined;
    return meta?.code === '1062';
  }
}
