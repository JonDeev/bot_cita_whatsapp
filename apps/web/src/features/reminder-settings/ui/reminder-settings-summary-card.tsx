import { formatDateTime } from '../../../shared/intl/date';
import {
  formatReminderRuntimeGlobalStateLabel,
  formatReminderRuntimeSendModeLabel,
  getReminderRuntimeUpdatedByLabel,
  type ReminderRuntimeSettingHistoryItem,
  type ReminderRuntimeSettings,
} from '../reminder-settings.types';

interface ReminderSettingsSummaryCardProps {
  settings: ReminderRuntimeSettings;
  latestHistoryItem?: ReminderRuntimeSettingHistoryItem | null;
  adminRole?: string | null;
}

export function ReminderSettingsSummaryCard({
  settings,
  latestHistoryItem,
  adminRole,
}: ReminderSettingsSummaryCardProps) {
  const globalState = formatReminderRuntimeGlobalStateLabel(settings);
  const updatedByLabel = getReminderRuntimeUpdatedByLabel(
    settings,
    latestHistoryItem?.actor ?? null,
  );
  const hasPersistedSettings = settings.metadata.version > 0;
  const restartScopedFieldCount = settings.runtimeApplication.restartScopedFieldKeys.length;

  return (
    <article className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.14em] text-[var(--muted)]">Estado activo</p>
          <h2 className="mt-1 text-xl font-semibold tracking-tight">{globalState.label}</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">{globalState.description}</p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${
            globalState.tone === 'warning'
              ? 'bg-amber-100 text-amber-900'
              : globalState.tone === 'success'
                ? 'bg-emerald-100 text-emerald-900'
                : 'bg-slate-100 text-slate-700'
          }`}
        >
          {settings.stored.emergencyPauseEnabled === 'enabled'
            ? 'Pausa activa'
            : 'Sin override'}
        </span>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl bg-[var(--panel-muted)] p-3">
          <p className="text-xs uppercase tracking-[0.12em] text-[var(--muted)]">Version</p>
          <p className="mt-1 text-lg font-semibold">
            {hasPersistedSettings ? `#${settings.metadata.version}` : 'Bootstrap'}
          </p>
        </div>
        <div className="rounded-2xl bg-[var(--panel-muted)] p-3">
          <p className="text-xs uppercase tracking-[0.12em] text-[var(--muted)]">
            Actualizacion
          </p>
          <p className="mt-1 text-sm font-semibold">
            {hasPersistedSettings
              ? formatDateTime(settings.metadata.lastUpdatedAtIso)
              : 'Sin cambios persistidos'}
          </p>
        </div>
        <div className="rounded-2xl bg-[var(--panel-muted)] p-3">
          <p className="text-xs uppercase tracking-[0.12em] text-[var(--muted)]">Autor</p>
          <p className="mt-1 text-sm font-semibold">
            {hasPersistedSettings ? updatedByLabel : 'Bootstrap'}
          </p>
        </div>
        <div className="rounded-2xl bg-[var(--panel-muted)] p-3">
          <p className="text-xs uppercase tracking-[0.12em] text-[var(--muted)]">Rol activo</p>
          <p className="mt-1 text-sm font-semibold">{adminRole ?? 'Lectura'}</p>
        </div>
      </div>

      <div className="mt-4 space-y-2 text-sm">
        <div className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border)] px-3 py-2">
          <span className="text-[var(--muted)]">Modo guardado</span>
          <span className="font-semibold">{formatReminderRuntimeSendModeLabel(settings.stored.sendMode)}</span>
        </div>
        <div className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border)] px-3 py-2">
          <span className="text-[var(--muted)]">Modo activo</span>
          <span className="font-semibold">
            {settings.stored.emergencyPauseEnabled === 'enabled'
              ? 'Pausado por emergencia'
              : formatReminderRuntimeSendModeLabel(settings.effectiveHotReloadable.sendMode)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border)] px-3 py-2">
          <span className="text-[var(--muted)]">Rollout guardado</span>
          <span className="font-semibold">{settings.stored.sendRolloutPercent}%</span>
        </div>
        <div className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border)] px-3 py-2">
          <span className="text-[var(--muted)]">Rollout activo</span>
          <span className="font-semibold">
            {settings.stored.emergencyPauseEnabled === 'enabled'
              ? 'Suspendido'
              : `${settings.effectiveHotReloadable.sendRolloutPercent}%`}
          </span>
        </div>
        <div className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border)] px-3 py-2">
          <span className="text-[var(--muted)]">Campos con reinicio</span>
          <span className="font-semibold">{restartScopedFieldCount}</span>
        </div>
      </div>

      <p className="mt-4 rounded-xl border border-dashed border-[var(--border)] bg-slate-50 px-3 py-2 text-sm text-[var(--muted)]">
        Los campos protegidos se guardan de inmediato, pero su efecto se activa con reinicio
        controlado. La lectura visible prioriza seguridad operativa.
      </p>
    </article>
  );
}
