import { StateMessage } from '../../../shared/ui/state-messages';
import { formatDateTime } from '../../../shared/intl/date';
import { getSurveyRuntimeUpdatedByLabel, type SurveyRuntimeSettingHistoryItem, type SurveyRuntimeSettings } from '../survey-settings.types';

interface SurveySettingsEmergencyPauseBannerProps {
  settings: SurveyRuntimeSettings;
  latestHistoryItem?: SurveyRuntimeSettingHistoryItem | null;
}

export function SurveySettingsEmergencyPauseBanner({
  settings,
  latestHistoryItem,
}: SurveySettingsEmergencyPauseBannerProps) {
  if (settings.stored.emergencyPauseEnabled !== 'enabled') {
    return null;
  }

  const updatedBy = getSurveyRuntimeUpdatedByLabel(
    settings,
    latestHistoryItem?.actor ?? null,
  );

  return (
    <StateMessage
      tone="warning"
      title="Pausa de emergencia activa."
      description={
        settings.metadata.emergencyPauseReason
          ? `${settings.metadata.emergencyPauseReason} Actualizado por ${updatedBy} el ${formatDateTime(settings.metadata.lastUpdatedAtIso)}.`
          : `Actualizado por ${updatedBy} el ${formatDateTime(settings.metadata.lastUpdatedAtIso)}.`
      }
    />
  );
}
