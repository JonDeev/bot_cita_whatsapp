import { RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAdminAccess } from '../features/auth/use-admin-access';
import {
  useSurveyRuntimeSettingsHistoryQuery,
  useSurveyRuntimeSettingsOptionsQuery,
  useSurveyRuntimeSettingsQuery,
} from '../features/survey-settings/survey-settings.hooks';
import { SurveySettingsEmergencyPauseBanner } from '../features/survey-settings/ui/survey-settings-emergency-pause-banner';
import { SurveySettingsEmergencyPauseCard } from '../features/survey-settings/ui/survey-settings-emergency-pause-card';
import { SurveySettingsEmergencyPauseDialog } from '../features/survey-settings/ui/survey-settings-emergency-pause-dialog';
import { SurveySettingsHistoryTable } from '../features/survey-settings/ui/survey-settings-history-table';
import { SurveySettingsPrimaryForm } from '../features/survey-settings/ui/survey-settings-primary-form';
import { SurveySettingsAdvancedForm } from '../features/survey-settings/ui/survey-settings-advanced-form';
import { SurveySettingsProtectedForm } from '../features/survey-settings/ui/survey-settings-protected-form';
import { SurveySettingsSummaryCard } from '../features/survey-settings/ui/survey-settings-summary-card';
import { formatAdminRoleLabel } from '../shared/intl/admin-labels';
import { formatDateTime } from '../shared/intl/date';
import { StateMessage } from '../shared/ui/state-messages';

const surveysAreaNavItems = [
  { to: '/admin/surveys', label: 'Operacion', end: true },
  { to: '/admin/surveys/settings', label: 'Configuracion', end: false },
] as const;

export function SurveySettingsPage() {
  const access = useAdminAccess();
  const settingsQuery = useSurveyRuntimeSettingsQuery();
  const optionsQuery = useSurveyRuntimeSettingsOptionsQuery();
  const historyQuery = useSurveyRuntimeSettingsHistoryQuery();
  const [emergencyPauseTargetEnabled, setEmergencyPauseTargetEnabled] = useState<
    boolean | null
  >(null);

  const settings = settingsQuery.data ?? null;
  const options = optionsQuery.data ?? null;
  const latestHistoryItem = historyQuery.data?.items[0] ?? null;
  const isLoading =
    settingsQuery.isLoading || optionsQuery.isLoading || historyQuery.isLoading;
  const isError =
    settingsQuery.isError || optionsQuery.isError || historyQuery.isError;

  const roleLabel = access.role ? formatAdminRoleLabel(access.role) : 'Lectura';

  const onRefresh = () => {
    void settingsQuery.refetch();
    void optionsQuery.refetch();
    void historyQuery.refetch();
  };

  const hasData = Boolean(settings && options);

  const layout = hasData ? (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
      <div className="space-y-4">
        <SurveySettingsPrimaryForm settings={settings!} options={options!} />
        <SurveySettingsAdvancedForm settings={settings!} options={options!} />
        <SurveySettingsProtectedForm settings={settings!} options={options!} />
      </div>

      <aside className="space-y-4">
        <SurveySettingsSummaryCard
          settings={settings!}
          latestHistoryItem={latestHistoryItem}
          adminRole={access.role ?? null}
        />

        <SurveySettingsEmergencyPauseCard
          settings={settings!}
          canToggle={settings!.permissions.canToggleEmergencyPause}
          onOpenDialog={(targetEnabled) => setEmergencyPauseTargetEnabled(targetEnabled)}
        />

        <article className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.14em] text-[var(--muted)]">
                Historial reciente
              </p>
              <h2 className="mt-1 text-lg font-semibold">Cambios recientes</h2>
            </div>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
              {historyQuery.data?.items.length ?? 0} eventos
            </span>
          </div>
          <div className="mt-4">
            <SurveySettingsHistoryTable
              items={historyQuery.data?.items ?? []}
              isLoading={historyQuery.isLoading}
              isError={historyQuery.isError}
            />
          </div>
        </article>
      </aside>
    </div>
  ) : null;

  return (
    <section className="space-y-4">
      <header className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--accent)]">
              Encuestas
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight">
              Configuracion operativa de encuestas
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-[var(--muted)]">
              Ajusta el modo de envio, los guardrails de despacho y la pausa de emergencia con
              versionado, auditoria y refresco seguro de estado.
            </p>
          </div>

          <button
            type="button"
            onClick={onRefresh}
            className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm font-medium text-[var(--text)] transition hover:bg-slate-50"
          >
            <RefreshCw size={14} />
            Refrescar
          </button>
        </div>

        <nav className="mt-4 flex flex-wrap gap-2" aria-label="Navegacion de encuestas">
          {surveysAreaNavItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `rounded-full border px-3 py-2 text-sm font-medium transition ${
                  isActive
                    ? 'border-teal-200 bg-teal-50 text-teal-900'
                    : 'border-[var(--border)] bg-white text-[var(--muted)] hover:bg-slate-50'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl bg-[var(--panel-muted)] p-3">
            <p className="text-xs uppercase tracking-[0.12em] text-[var(--muted)]">Versión</p>
            <p className="mt-1 text-lg font-semibold">
              {settings
                ? settings.metadata.version > 0
                  ? `#${settings.metadata.version}`
                  : 'Bootstrap'
                : '-'}
            </p>
          </div>
          <div className="rounded-2xl bg-[var(--panel-muted)] p-3">
            <p className="text-xs uppercase tracking-[0.12em] text-[var(--muted)]">
              Última actualización
            </p>
            <p className="mt-1 text-sm font-semibold">
              {settings
                ? settings.metadata.version > 0
                  ? formatDateTime(settings.metadata.lastUpdatedAtIso)
                  : 'Sin cambios persistidos'
                : '-'}
            </p>
          </div>
          <div className="rounded-2xl bg-[var(--panel-muted)] p-3">
            <p className="text-xs uppercase tracking-[0.12em] text-[var(--muted)]">
              Rol activo
            </p>
            <p className="mt-1 text-sm font-semibold">{roleLabel}</p>
          </div>
        </div>
      </header>

      {settings ? (
        <SurveySettingsEmergencyPauseBanner
          settings={settings}
          latestHistoryItem={latestHistoryItem}
        />
      ) : null}

      {isLoading ? (
        <StateMessage
          title="Cargando configuracion operativa..."
          description="Recuperando estado almacenado, opciones permitidas e historial reciente."
        />
      ) : null}

      {isError ? (
        <StateMessage
          title="No fue posible cargar la configuracion."
          description="Reintenta en unos segundos."
          tone="danger"
        />
      ) : null}

      {layout}

      {settings && emergencyPauseTargetEnabled !== null ? (
        <SurveySettingsEmergencyPauseDialog
          settings={settings}
          open={emergencyPauseTargetEnabled !== null}
          targetEnabled={emergencyPauseTargetEnabled}
          onClose={() => setEmergencyPauseTargetEnabled(null)}
        />
      ) : null}
    </section>
  );
}
