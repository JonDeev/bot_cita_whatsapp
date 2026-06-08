import { Injectable } from '@nestjs/common';
import { Prisma } from '@whatsapp-bot/prisma-client';
import type { ReminderRuntimeSection } from '@whatsapp-bot/shared';
import { PrismaBotService } from '../../../../../shared/infrastructure/prisma-bot/prisma-bot.service';
import type {
  AppointmentReminderRuntimeSettingsRepository,
  SaveAppointmentReminderRuntimeSettingsCommand,
  SaveAppointmentReminderRuntimeSettingsResult,
} from '../../../domain/ports/appointment-reminder-runtime-settings.repository';
import type {
  AppointmentReminderRuntimeSettingChangeType,
  AppointmentReminderRuntimeSettingEventRecord,
  AppointmentReminderRuntimeSettingsRecord,
  AppointmentReminderRuntimeSettingsSnapshot,
} from '../../../domain/appointment-reminder-runtime.types';

type RuntimeSettingsRow =
  PrismaBotService['botAppointmentReminderRuntimeSettings'] extends {
    findUniqueOrThrow: (...args: never[]) => Promise<infer T>;
  }
    ? T
    : never;

type RuntimeSettingEventRow = Prisma.BotAppointmentReminderRuntimeSettingEventGetPayload<
  {
    include: {
      adminUser: {
        select: {
          displayName: true;
          username: true;
        };
      };
    };
  }
>;

@Injectable()
export class PrismaBotAppointmentReminderRuntimeSettingsRepository
  implements AppointmentReminderRuntimeSettingsRepository
{
  constructor(private readonly prismaBot: PrismaBotService) {}

  async findByScope(
    scopeKey: string,
  ): Promise<AppointmentReminderRuntimeSettingsRecord | null> {
    const row = await this.prismaBot.botAppointmentReminderRuntimeSettings.findUnique(
      {
        where: {
          scopeKey,
        },
      },
    );

    return row ? this.mapSettings(row) : null;
  }

  async listEvents(input: {
    limit: number;
  }): Promise<AppointmentReminderRuntimeSettingEventRecord[]> {
    const rows =
      await this.prismaBot.botAppointmentReminderRuntimeSettingEvent.findMany({
        include: {
          adminUser: {
            select: {
              displayName: true,
              username: true,
            },
          },
        },
        orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
        take: input.limit,
      });

    return rows.map((row) => this.mapEvent(row));
  }

  async findLatestEventByChangeTypes(input: {
    changeTypes: readonly AppointmentReminderRuntimeSettingChangeType[];
  }): Promise<AppointmentReminderRuntimeSettingEventRecord | null> {
    const row =
      await this.prismaBot.botAppointmentReminderRuntimeSettingEvent.findFirst(
        {
          include: {
            adminUser: {
              select: {
                displayName: true,
                username: true,
              },
            },
          },
          where: {
            changeType: {
              in: [...input.changeTypes],
            },
          },
          orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
        },
      );

    return row ? this.mapEvent(row) : null;
  }

  async saveWithEvent(
    command: SaveAppointmentReminderRuntimeSettingsCommand,
  ): Promise<SaveAppointmentReminderRuntimeSettingsResult | null> {
    return this.prismaBot.$transaction(async (tx) => {
      const existing = await tx.botAppointmentReminderRuntimeSettings.findUnique(
        {
          where: {
            scopeKey: command.scopeKey,
          },
        },
      );

      if (!existing) {
        if (command.expectedVersion !== 0) {
          return null;
        }

        let created: RuntimeSettingsRow;
        try {
          created = await tx.botAppointmentReminderRuntimeSettings.create({
            data: {
              scopeKey: command.scopeKey,
              ...this.snapshotToSettingsData(command.nextSnapshot),
              version: 1,
              updatedByAdminUserId: command.adminUserId,
            },
          });
        } catch (error) {
          if (this.isUniqueConstraintError(error)) {
            return null;
          }

          throw error;
        }

        const event = await tx.botAppointmentReminderRuntimeSettingEvent.create({
          data: {
            settingsVersion: created.version,
            adminUserId: command.adminUserId,
            changeType: command.changeType,
            section: command.section,
            reason: command.reason,
            previousSnapshotJson: this.snapshotToJson(command.nextSnapshot),
            newSnapshotJson: this.snapshotToJson(command.nextSnapshot),
            effectiveSnapshotJson: this.snapshotToJson(command.effectiveSnapshot),
            occurredAt: new Date(command.occurredAtIso),
          },
        });

        await tx.botAdminAuditEvent.create({
          data: {
            adminUserId: command.adminUserId,
            action: command.adminAudit.action,
            resourceType: command.adminAudit.resourceType,
            resourceId: command.adminAudit.resourceId,
            metadata: command.adminAudit.metadata,
            ipHash: command.adminAudit.ipHash,
            occurredAt: new Date(command.occurredAtIso),
          },
        });

        return {
          settings: this.mapSettings(created),
          event: this.mapEvent(event),
        };
      }

      if (existing.version !== command.expectedVersion) {
        return null;
      }

      const updatedMany = await tx.botAppointmentReminderRuntimeSettings.updateMany(
        {
          where: {
            id: existing.id,
            version: command.expectedVersion,
          },
          data: {
            ...this.snapshotToSettingsData(command.nextSnapshot),
            version: {
              increment: 1,
            },
            updatedByAdminUserId: command.adminUserId,
          },
        },
      );

      if (updatedMany.count !== 1) {
        return null;
      }

      const updated =
        await tx.botAppointmentReminderRuntimeSettings.findUniqueOrThrow({
          where: {
            id: existing.id,
          },
        });

      const event = await tx.botAppointmentReminderRuntimeSettingEvent.create({
        data: {
          settingsVersion: updated.version,
          adminUserId: command.adminUserId,
          changeType: command.changeType,
          section: command.section,
          reason: command.reason,
          previousSnapshotJson: this.snapshotToJson(this.mapSnapshot(existing)),
          newSnapshotJson: this.snapshotToJson(command.nextSnapshot),
          effectiveSnapshotJson: this.snapshotToJson(command.effectiveSnapshot),
          occurredAt: new Date(command.occurredAtIso),
        },
      });

      await tx.botAdminAuditEvent.create({
        data: {
          adminUserId: command.adminUserId,
          action: command.adminAudit.action,
          resourceType: command.adminAudit.resourceType,
          resourceId: command.adminAudit.resourceId,
          metadata: command.adminAudit.metadata,
          ipHash: command.adminAudit.ipHash,
          occurredAt: new Date(command.occurredAtIso),
        },
      });

      return {
        settings: this.mapSettings(updated),
        event: this.mapEvent(event),
      };
    });
  }

  private snapshotToSettingsData(
    snapshot: AppointmentReminderRuntimeSettingsSnapshot,
  ) {
    return {
      syncEnabled: snapshot.syncEnabled,
      dispatchEnabled: snapshot.dispatchEnabled,
      queueEnabled: snapshot.queueEnabled,
      sendMode: snapshot.sendMode,
      sendRolloutPercent: snapshot.sendRolloutPercent,
      emergencyPauseEnabled: snapshot.emergencyPauseEnabled,
      syncIntervalMs: snapshot.syncIntervalMs,
      recoverySweepIntervalMs: snapshot.recoverySweepIntervalMs,
      workerConcurrency: snapshot.workerConcurrency,
      dispatchBatchSize: snapshot.dispatchBatchSize,
      eligibilityLimit: snapshot.eligibilityLimit,
      lockTtlSeconds: snapshot.lockTtlSeconds,
      lockHeartbeatIntervalMs: snapshot.lockHeartbeatIntervalMs,
      minConfirmationHours: snapshot.minConfirmationHours,
    };
  }

  private snapshotToJson(
    snapshot: AppointmentReminderRuntimeSettingsSnapshot,
  ): Prisma.InputJsonValue {
    return {
      sendMode: snapshot.sendMode,
      sendRolloutPercent: snapshot.sendRolloutPercent,
      emergencyPauseEnabled: snapshot.emergencyPauseEnabled,
      dispatchBatchSize: snapshot.dispatchBatchSize,
      eligibilityLimit: snapshot.eligibilityLimit,
      syncEnabled: snapshot.syncEnabled,
      dispatchEnabled: snapshot.dispatchEnabled,
      queueEnabled: snapshot.queueEnabled,
      syncIntervalMs: snapshot.syncIntervalMs,
      recoverySweepIntervalMs: snapshot.recoverySweepIntervalMs,
      workerConcurrency: snapshot.workerConcurrency,
      lockTtlSeconds: snapshot.lockTtlSeconds,
      lockHeartbeatIntervalMs: snapshot.lockHeartbeatIntervalMs,
      minConfirmationHours: snapshot.minConfirmationHours,
    };
  }

  private mapSettings(
    row: RuntimeSettingsRow,
  ): AppointmentReminderRuntimeSettingsRecord {
    return {
      id: row.id,
      scopeKey: row.scopeKey,
      version: row.version,
      snapshot: this.mapSnapshot(row),
      updatedByAdminUserId: row.updatedByAdminUserId,
      updatedAtIso: row.updatedAt.toISOString(),
      createdAtIso: row.createdAt.toISOString(),
    };
  }

  private mapSnapshot(
    row: Pick<
      RuntimeSettingsRow,
      | 'sendMode'
      | 'sendRolloutPercent'
      | 'emergencyPauseEnabled'
      | 'dispatchBatchSize'
      | 'eligibilityLimit'
      | 'syncEnabled'
      | 'dispatchEnabled'
      | 'queueEnabled'
      | 'syncIntervalMs'
      | 'recoverySweepIntervalMs'
      | 'workerConcurrency'
      | 'lockTtlSeconds'
      | 'lockHeartbeatIntervalMs'
      | 'minConfirmationHours'
    >,
  ): AppointmentReminderRuntimeSettingsSnapshot {
    return {
      sendMode:
        row.sendMode as AppointmentReminderRuntimeSettingsSnapshot['sendMode'],
      sendRolloutPercent:
        row.sendRolloutPercent as AppointmentReminderRuntimeSettingsSnapshot['sendRolloutPercent'],
      emergencyPauseEnabled: row.emergencyPauseEnabled,
      dispatchBatchSize:
        row.dispatchBatchSize as AppointmentReminderRuntimeSettingsSnapshot['dispatchBatchSize'],
      eligibilityLimit:
        row.eligibilityLimit as AppointmentReminderRuntimeSettingsSnapshot['eligibilityLimit'],
      syncEnabled: row.syncEnabled,
      dispatchEnabled: row.dispatchEnabled,
      queueEnabled: row.queueEnabled,
      syncIntervalMs:
        row.syncIntervalMs as AppointmentReminderRuntimeSettingsSnapshot['syncIntervalMs'],
      recoverySweepIntervalMs:
        row.recoverySweepIntervalMs as AppointmentReminderRuntimeSettingsSnapshot['recoverySweepIntervalMs'],
      workerConcurrency:
        row.workerConcurrency as AppointmentReminderRuntimeSettingsSnapshot['workerConcurrency'],
      lockTtlSeconds:
        row.lockTtlSeconds as AppointmentReminderRuntimeSettingsSnapshot['lockTtlSeconds'],
      lockHeartbeatIntervalMs:
        row.lockHeartbeatIntervalMs as AppointmentReminderRuntimeSettingsSnapshot['lockHeartbeatIntervalMs'],
      minConfirmationHours:
        row.minConfirmationHours as AppointmentReminderRuntimeSettingsSnapshot['minConfirmationHours'],
    };
  }

  private mapEvent(
    row: Omit<RuntimeSettingEventRow, 'adminUser'> & {
      adminUser?: RuntimeSettingEventRow['adminUser'];
    },
  ): AppointmentReminderRuntimeSettingEventRecord {
    return {
      id: row.id,
      settingsVersion: row.settingsVersion,
      adminUserId: row.adminUserId,
      actor: {
        displayName: row.adminUser?.displayName ?? null,
        username: row.adminUser?.username ?? null,
      },
      changeType:
        row.changeType as AppointmentReminderRuntimeSettingChangeType,
      section: row.section as ReminderRuntimeSection,
      reason: row.reason,
      previousSnapshot: this.parseSnapshotJson(row.previousSnapshotJson),
      newSnapshot: this.parseSnapshotJson(row.newSnapshotJson),
      effectiveSnapshot: this.parseSnapshotJson(row.effectiveSnapshotJson),
      occurredAtIso: row.occurredAt.toISOString(),
      createdAtIso: row.createdAt.toISOString(),
    };
  }

  private parseSnapshotJson(
    value: Prisma.JsonValue,
  ): AppointmentReminderRuntimeSettingsSnapshot {
    const snapshot = value as Record<string, unknown>;

    return {
      sendMode: snapshot.sendMode as AppointmentReminderRuntimeSettingsSnapshot['sendMode'],
      sendRolloutPercent:
        snapshot.sendRolloutPercent as AppointmentReminderRuntimeSettingsSnapshot['sendRolloutPercent'],
      emergencyPauseEnabled:
        snapshot.emergencyPauseEnabled as AppointmentReminderRuntimeSettingsSnapshot['emergencyPauseEnabled'],
      dispatchBatchSize:
        snapshot.dispatchBatchSize as AppointmentReminderRuntimeSettingsSnapshot['dispatchBatchSize'],
      eligibilityLimit:
        snapshot.eligibilityLimit as AppointmentReminderRuntimeSettingsSnapshot['eligibilityLimit'],
      syncEnabled:
        snapshot.syncEnabled as AppointmentReminderRuntimeSettingsSnapshot['syncEnabled'],
      dispatchEnabled:
        snapshot.dispatchEnabled as AppointmentReminderRuntimeSettingsSnapshot['dispatchEnabled'],
      queueEnabled:
        snapshot.queueEnabled as AppointmentReminderRuntimeSettingsSnapshot['queueEnabled'],
      syncIntervalMs:
        snapshot.syncIntervalMs as AppointmentReminderRuntimeSettingsSnapshot['syncIntervalMs'],
      recoverySweepIntervalMs:
        snapshot.recoverySweepIntervalMs as AppointmentReminderRuntimeSettingsSnapshot['recoverySweepIntervalMs'],
      workerConcurrency:
        snapshot.workerConcurrency as AppointmentReminderRuntimeSettingsSnapshot['workerConcurrency'],
      lockTtlSeconds:
        snapshot.lockTtlSeconds as AppointmentReminderRuntimeSettingsSnapshot['lockTtlSeconds'],
      lockHeartbeatIntervalMs:
        snapshot.lockHeartbeatIntervalMs as AppointmentReminderRuntimeSettingsSnapshot['lockHeartbeatIntervalMs'],
      minConfirmationHours:
        snapshot.minConfirmationHours as AppointmentReminderRuntimeSettingsSnapshot['minConfirmationHours'],
    };
  }

  private isUniqueConstraintError(
    error: unknown,
  ): error is Prisma.PrismaClientKnownRequestError {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
      return false;
    }

    return error.code === 'P2002';
  }
}
