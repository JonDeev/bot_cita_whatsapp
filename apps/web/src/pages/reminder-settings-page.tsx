import { RefreshCw } from 'lucide-react';
import { useMemo, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAdminAccess } from '../features/auth/use-admin-access';
import { formatAdminRoleLabel } from '../shared/intl/admin-labels';
import { formatDateTime } from '../shared/intl/date';
import { StateMessage } from '../shared/ui/state-messages';
import { useReminderRuntimeSettingsHistoryQuery, useReminderRuntimeSettingsOptionsQuery, useReminderRuntimeSettingsQuery } from '../features/reminder-settings/reminder-settings.hooks';
import { EmergencyPauseBanner } from '../features/reminder-settings/ui/emergency-pause-banner';
import { ReminderSettingsEmergencyPauseCard } from '../features/reminder-settings/ui/reminder-settings-emergency-pause-card';
import { ReminderSettingsEmergencyPauseDialog } from '../features/reminder-settings/ui/reminder-settings-emergency-pause-dialog';
import { ReminderSettingsHistoryTable } from '../features/reminder-settings/ui/reminder-settings-history-table';
import { ReminderSettingsSummaryCard } from '../features/reminder-settings/ui/reminder-settings-summary-card';
import { ReminderSettingsAdvancedForm } from '../features/reminder-settings/ui/reminder-settings-advanced-form';
import { ReminderSettingsPrimaryForm } from '../features/reminder-settings/ui/reminder-settings-primary-form';
import { ReminderSettingsProtectedForm } from '../features/reminder-settings/ui/reminder-settings-protected-form';

const remindersAreaNavItems = [
  { to: '/admin/reminders', label: 'Operacion', end: true },
  { to: '/admin/reminders/settings', label: 'Configuracion', end: false },
  { to: '/admin/reminders/settings/guide', label: 'Guia de uso', end: false },
] as const;

export function ReminderSettingsPage() {
  const access = useAdminAccess();
  const settingsQuery = useReminderRuntimeSettingsQuery();
  const optionsQuery = useReminderRuntimeSettingsOptionsQuery();
  const historyQuery = useReminderRuntimeSettingsHistoryQuery();
  const [emergencyPauseTargetEnabled, setEmergencyPauseTargetEnabled] = useState<
    boolean | null
  >(null);

  const settings = settingsQuery.data ?? null;
  const options = optionsQuery.data ?? null;
  const latestHistoryItem = historyQuery.data?.items[0] ?? null;
  const isLoading =
    settingsQuery.isLoading || optionsQuery.isLoading || historyQuery.isLoading;
  const isError = settingsQuery.isError || optionsQuery.isError || historyQuery.isError;

  const metadataUpdatedBy = useMemo(() => {
    if (!settings) {
      return '-';
    }

    if (latestHistoryItem?.actor.displayName) {
      return latestHistoryItem.actor.displayName;
    }

    if (latestHistoryItem?.actor.username) {
      return latestHistoryItem.actor.username;
    }

    if (settings.metadata.lastUpdatedByAdminUserId) {
      return `Administrador #${settings.metadata.lastUpdatedByAdminUserId}`;
    }

    return 'Sistema';
  }, [latestHistoryItem?.actor.displayName, latestHistoryItem?.actor.username, settings]);

  const onRefresh = () => {
    void settingsQuery.refetch();
    void optionsQuery.refetch();
    void historyQuery.refetch();
  };

  const roleLabel = access.role ? formatAdminRoleLabel(access.role) : 'Lectura';
  const hasPersistedSettings = settings ? settings.metadata.version > 0 : false;

  return (
    <section className="space-y-4">
      <header className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--accent)]">
              Recordatorios
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight">
              Configuracion operativa de recordatorios
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-[var(--muted)]">
              Ajusta controles diarios, parametros protegidos y pausa de emergencia con
              versionado, trazabilidad y refresco seguro de estado.
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

        <nav className="mt-4 flex flex-wrap gap-2" aria-label="Navegacion de recordatorios">
          {remindersAreaNavItems.map((item) => (
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
            <p className="text-xs uppercase tracking-[0.12em] text-[var(--muted)]">Version</p>
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
              Ultima actualizacion
            </p>
            <p className="mt-1 text-sm font-semibold">
              {settings
                ? hasPersistedSettings
                  ? formatDateTime(settings.metadata.lastUpdatedAtIso)
                  : 'Sin cambios persistidos'
                : '-'}
            </p>
          </div>
          <div className="rounded-2xl bg-[var(--panel-muted)] p-3">
            <p className="text-xs uppercase tracking-[0.12em] text-[var(--muted)]">
              Actualizado por
            </p>
            <p className="mt-1 text-sm font-semibold">
              {hasPersistedSettings ? metadataUpdatedBy : 'Bootstrap'}
            </p>
          </div>
        </div>

        <p className="mt-4 text-xs text-[var(--muted)]">Rol activo: {roleLabel}</p>
      </header>

      {settings ? <EmergencyPauseBanner settings={settings} latestHistoryItem={latestHistoryItem} /> : null}

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

      {settings && options ? (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
          <div className="space-y-4">
            <ReminderSettingsPrimaryForm settings={settings} options={options} />
            <ReminderSettingsAdvancedForm settings={settings} options={options} />
            <ReminderSettingsProtectedForm settings={settings} options={options} />
          </div>

          <aside className="space-y-4">
            <ReminderSettingsSummaryCard
              settings={settings}
              latestHistoryItem={latestHistoryItem}
              adminRole={access.role ? formatAdminRoleLabel(access.role) : null}
            />

            <ReminderSettingsEmergencyPauseCard
              settings={settings}
              canToggle={settings.permissions.canToggleEmergencyPause}
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
                <ReminderSettingsHistoryTable
                  items={historyQuery.data?.items ?? []}
                  isLoading={historyQuery.isLoading}
                  isError={historyQuery.isError}
                />
              </div>
            </article>
          </aside>
        </div>
      ) : null}

      {settings && emergencyPauseTargetEnabled !== null ? (
        <ReminderSettingsEmergencyPauseDialog
          settings={settings}
          open={emergencyPauseTargetEnabled !== null}
          targetEnabled={emergencyPauseTargetEnabled}
          onClose={() => setEmergencyPauseTargetEnabled(null)}
        />
      ) : null}
    </section>
  );
}
