import { formatDateTime } from '../../../shared/intl/date';
import { DataTable, type DataTableColumn } from '../../../shared/ui/data-table';
import {
  formatSurveyRuntimeChangeTypeLabel,
  formatSurveyRuntimeSectionLabel,
  type SurveyRuntimeSettingHistoryItem,
} from '../survey-settings.types';

interface SurveySettingsHistoryTableProps {
  items: SurveyRuntimeSettingHistoryItem[];
  isLoading?: boolean;
  isError?: boolean;
}

export function SurveySettingsHistoryTable({
  items,
  isLoading = false,
  isError = false,
}: SurveySettingsHistoryTableProps) {
  const columns: DataTableColumn<SurveyRuntimeSettingHistoryItem>[] = [
    {
      id: 'version',
      header: 'Version',
      cell: (item) => `#${item.settingsVersion}`,
    },
    {
      id: 'changeType',
      header: 'Cambio',
      cell: (item) => formatSurveyRuntimeChangeTypeLabel(item.changeType),
    },
    {
      id: 'section',
      header: 'Sección',
      cell: (item) => formatSurveyRuntimeSectionLabel(item.section),
    },
    {
      id: 'actor',
      header: 'Actor',
      cell: (item) =>
        item.actor.displayName ||
        item.actor.username ||
        (item.actor.adminUserId ? `#${item.actor.adminUserId}` : 'Sistema'),
    },
    {
      id: 'reason',
      header: 'Razón',
      cell: (item) => item.reason ?? '-',
    },
    {
      id: 'occurredAt',
      header: 'Fecha',
      cell: (item) => formatDateTime(item.occurredAtIso),
    },
  ];

  return (
    <DataTable
      columns={columns}
      items={items}
      getRowKey={(item) => item.id}
      emptyTitle="No hay eventos recientes."
      emptyDescription="Los cambios de configuración aparecerán aquí cuando se guarden."
      isLoading={isLoading}
      isError={isError}
      loadingTitle="Cargando historial de configuración..."
      errorTitle="No fue posible cargar el historial."
      errorDescription="Reintenta en unos segundos."
    />
  );
}
