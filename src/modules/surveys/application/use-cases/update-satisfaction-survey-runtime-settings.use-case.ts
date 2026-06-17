import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';
import type {
  AdminRole,
  SurveyRuntimeSection,
  SurveyRuntimeSettingKey,
  SurveyRuntimeSettingsDto,
  SurveyRuntimeSettingsSnapshotDto,
} from '@whatsapp-bot/shared';
import {
  SATISFACTION_SURVEY_RUNTIME_SETTING_CHANGE_TYPES,
  SATISFACTION_SURVEY_RUNTIME_SETTINGS_SCOPE_DEFAULT,
} from '../../domain/satisfaction-survey-runtime.types';
import {
  SATISFACTION_SURVEY_RUNTIME_SETTINGS_REPOSITORY,
} from '../../domain/surveys.tokens';
import type { SatisfactionSurveyRuntimeSettingsRepository } from '../../domain/ports/satisfaction-survey-runtime-settings.repository';
import { SatisfactionSurveyRuntimeSettingsCatalogService } from '../services/satisfaction-survey-runtime-settings-catalog.service';
import { SatisfactionSurveyRuntimeSettingsResolverService } from '../services/satisfaction-survey-runtime-settings-resolver.service';

export interface UpdateSatisfactionSurveyRuntimeSettingsInput {
  adminUserId: number;
  adminRole: AdminRole;
  expectedVersion: number;
  reason?: string;
  changes: Partial<SurveyRuntimeSettingsSnapshotDto>;
}

@Injectable()
export class UpdateSatisfactionSurveyRuntimeSettingsUseCase {
  constructor(
    @Inject(SATISFACTION_SURVEY_RUNTIME_SETTINGS_REPOSITORY)
    private readonly repository: SatisfactionSurveyRuntimeSettingsRepository,
    private readonly resolver: SatisfactionSurveyRuntimeSettingsResolverService,
    private readonly catalog: SatisfactionSurveyRuntimeSettingsCatalogService,
  ) {}

  async execute(
    input: UpdateSatisfactionSurveyRuntimeSettingsInput,
  ): Promise<SurveyRuntimeSettingsDto> {
    const changedKeys = this.getChangedKeys(input.changes);
    if (changedKeys.length === 0) {
      throw new BadRequestException('At least one survey setting is required.');
    }

    if (changedKeys.includes('emergencyPauseEnabled')) {
      throw new BadRequestException(
        'Use the dedicated emergency pause endpoint for this field.',
      );
    }

    this.assertRoleCanEdit(changedKeys, input.adminRole);

    const reason = this.normalizeReason(input.reason);
    if (this.requiresReason(changedKeys) && !reason) {
      throw new BadRequestException(
        'A reason is required for high-impact survey settings.',
      );
    }

    const storedSnapshot = await this.resolver.resolveStoredSnapshot();
    const currentDto = this.catalog.toDtoSnapshot(storedSnapshot);
    const nextDto = {
      ...currentDto,
      ...input.changes,
    } as SurveyRuntimeSettingsSnapshotDto;

    if (this.isSameSnapshot(currentDto, nextDto)) {
      throw new BadRequestException('The requested survey settings are already applied.');
    }

    const nextSnapshot = this.catalog.toDomainSnapshot(nextDto);
    const section = this.resolveSection(changedKeys);
    const result = await this.repository.saveWithEvent({
      scopeKey: SATISFACTION_SURVEY_RUNTIME_SETTINGS_SCOPE_DEFAULT,
      expectedVersion: input.expectedVersion,
      nextSnapshot,
      effectiveSnapshot: nextSnapshot,
      adminUserId: input.adminUserId,
      changeType:
        SATISFACTION_SURVEY_RUNTIME_SETTING_CHANGE_TYPES.SETTINGS_UPDATED,
      section,
      reason,
      occurredAtIso: new Date().toISOString(),
      adminAudit: {
        action: 'admin.surveys.settings_updated',
        resourceType: 'satisfaction_survey_runtime_settings',
        resourceId: SATISFACTION_SURVEY_RUNTIME_SETTINGS_SCOPE_DEFAULT,
        metadata: {
          role: input.adminRole,
          section,
          fieldCount: changedKeys.length,
          changedKeys: changedKeys.join(','),
          reasonProvided: Boolean(reason),
          expectedVersion: input.expectedVersion,
        },
        ipHash: null,
      },
    });

    if (!result) {
      throw new ConflictException(
        'Survey runtime settings changed before this update completed.',
      );
    }

    const view = await this.resolver.resolveRuntimeView();
    return {
      ...view,
      permissions: this.catalog.getPermissionsForRole(input.adminRole),
    };
  }

  private assertRoleCanEdit(
    changedKeys: readonly SurveyRuntimeSettingKey[],
    adminRole: AdminRole,
  ): void {
    for (const key of changedKeys) {
      if (!this.catalog.isEditableByRole(key, adminRole)) {
        throw new ForbiddenException(
          `Role ${adminRole} cannot edit survey setting ${key}.`,
        );
      }
    }
  }

  private resolveSection(
    changedKeys: readonly SurveyRuntimeSettingKey[],
  ): SurveyRuntimeSection {
    if (changedKeys.some((key) => this.catalog.getFieldSection(key) === 'protected')) {
      return 'protected';
    }

    if (changedKeys.some((key) => this.catalog.getFieldSection(key) === 'advanced')) {
      return 'advanced';
    }

    return 'primary';
  }

  private requiresReason(
    changedKeys: readonly SurveyRuntimeSettingKey[],
  ): boolean {
    return changedKeys.some((key) => this.catalog.requiresReason(key));
  }

  private getChangedKeys(
    changes: Partial<SurveyRuntimeSettingsSnapshotDto>,
  ): SurveyRuntimeSettingKey[] {
    return Object.keys(changes) as SurveyRuntimeSettingKey[];
  }

  private normalizeReason(reason: string | undefined): string | null {
    const trimmed = reason?.trim();
    return trimmed ? trimmed : null;
  }

  private isSameSnapshot(
    current: SurveyRuntimeSettingsSnapshotDto,
    next: SurveyRuntimeSettingsSnapshotDto,
  ): boolean {
    return JSON.stringify(current) === JSON.stringify(next);
  }
}
