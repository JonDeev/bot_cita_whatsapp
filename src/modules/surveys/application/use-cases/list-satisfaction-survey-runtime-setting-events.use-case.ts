import { Inject, Injectable } from '@nestjs/common';
import type {
  SurveyRuntimeSettingHistoryItemDto,
  SurveyRuntimeSettingHistoryResultDto,
  SurveyRuntimeSection,
} from '@whatsapp-bot/shared';
import {
  SATISFACTION_SURVEY_RUNTIME_SETTINGS_REPOSITORY,
} from '../../domain/surveys.tokens';
import type { SatisfactionSurveyRuntimeSettingsRepository } from '../../domain/ports/satisfaction-survey-runtime-settings.repository';
import { SatisfactionSurveyRuntimeSettingsCatalogService } from '../services/satisfaction-survey-runtime-settings-catalog.service';

export interface ListSatisfactionSurveyRuntimeSettingEventsInput {
  limit: number;
}

@Injectable()
export class ListSatisfactionSurveyRuntimeSettingEventsUseCase {
  constructor(
    @Inject(SATISFACTION_SURVEY_RUNTIME_SETTINGS_REPOSITORY)
    private readonly repository: SatisfactionSurveyRuntimeSettingsRepository,
    private readonly catalog: SatisfactionSurveyRuntimeSettingsCatalogService,
  ) {}

  async execute(
    input: ListSatisfactionSurveyRuntimeSettingEventsInput,
  ): Promise<SurveyRuntimeSettingHistoryResultDto> {
    const limit = this.resolveLimit(input.limit);
    const events = await this.repository.listEvents({ limit });

    return {
      items: events.map((event) => this.mapEvent(event)),
    };
  }

  private mapEvent(
    event: Awaited<
      ReturnType<SatisfactionSurveyRuntimeSettingsRepository['listEvents']>
    >[number],
  ): SurveyRuntimeSettingHistoryItemDto {
    return {
      id: event.id,
      settingsVersion: event.settingsVersion,
      changeType: event.changeType,
      section: event.section as SurveyRuntimeSection,
      reason: event.reason,
      occurredAtIso: event.occurredAtIso,
      actor: {
        adminUserId: event.adminUserId,
        displayName: event.actor.displayName,
        username: event.actor.username,
      },
      previousSnapshot: this.catalog.toDtoSnapshot(event.previousSnapshot),
      newSnapshot: this.catalog.toDtoSnapshot(event.newSnapshot),
      effectiveSnapshot: this.catalog.toDtoSnapshot(event.effectiveSnapshot),
    };
  }

  private resolveLimit(limit: number): number {
    if (!Number.isInteger(limit) || limit <= 0) {
      return 10;
    }

    return Math.min(limit, 100);
  }
}
