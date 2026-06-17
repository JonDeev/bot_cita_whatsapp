import { formatAdminRoleLabel } from '../../../shared/intl/admin-labels';
import { formatDateTime } from '../../../shared/intl/date';
import { SURVEY_RUNTIME_RESTART_SCOPED_SETTING_KEYS } from '@whatsapp-bot/shared';
import {
  formatSurveyRuntimeGlobalStateLabel,
  formatSurveyRuntimeScheduleProfileLabel,
  formatSurveyRuntimeSendModeLabel,
  getSurveyRuntimeUpdatedByLabel,
  type SurveyRuntimeSettingHistoryItem,
  type SurveyRuntimeSettings,
} from '../survey-settings.types';

interface SurveySettingsSummaryCardProps {
  settings: SurveyRuntimeSettings;
  latestHistoryItem?: SurveyRuntimeSettingHistoryItem | null;
  adminRole?: string | null;
}

export function SurveySettingsSummaryCard({
  settings,
  latestHistoryItem,
  adminRole,
}: SurveySettingsSummaryCardProps) {
  const restartScopedFieldCount =
    SURVEY_RUNTIME_RESTART_SCOPED_SETTING_KEYS.length;
  const globalState = formatSurveyRuntimeGlobalStateLabel(settings);
  const updatedByLabel = getSurveyRuntimeUpdatedByLabel(
    settings,
    latestHistoryItem?.actor ?? null,
  );
  const hasPersistedSettings = settings.metadata.version > 0;

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
          <p className="text-xs uppercase tracking-[0.12em] text-[var(--muted)]">Versión</p>
          <p className="mt-1 text-lg font-semibold">
            {hasPersistedSettings ? `#${settings.metadata.version}` : 'Bootstrap'}
          </p>
        </div>
        <div className="rounded-2xl bg-[var(--panel-muted)] p-3">
          <p className="text-xs uppercase tracking-[0.12em] text-[var(--muted)]">
            Actualización
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
          <p className="text-xs uppercase tracking-[0.12em] text-[var(--muted)]">Rol</p>
          <p className="mt-1 text-sm font-semibold">
            {adminRole ? formatAdminRoleLabel(adminRole) : 'Lectura'}
          </p>
        </div>
      </div>

      <div className="mt-4 space-y-2 text-sm">
        <div className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border)] px-3 py-2">
          <span className="text-[var(--muted)]">Modo guardado</span>
          <span className="font-semibold">
            {formatSurveyRuntimeSendModeLabel(settings.stored.sendMode)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border)] px-3 py-2">
          <span className="text-[var(--muted)]">Modo efectivo</span>
          <span className="font-semibold">
            {settings.stored.emergencyPauseEnabled === 'enabled'
              ? 'Pausado por emergencia'
              : formatSurveyRuntimeSendModeLabel(
                  settings.effectiveHotReloadable.sendMode,
                )}
          </span>
        </div>
        <div className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border)] px-3 py-2">
          <span className="text-[var(--muted)]">Rollout guardado</span>
          <span className="font-semibold">{settings.stored.sendRolloutPercent}%</span>
        </div>
        <div className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border)] px-3 py-2">
          <span className="text-[var(--muted)]">Perfil de horario</span>
          <span className="font-semibold">
            {formatSurveyRuntimeScheduleProfileLabel(settings.stored.scheduleProfile)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border)] px-3 py-2">
          <span className="text-[var(--muted)]">Campos con reinicio</span>
          <span className="font-semibold">{restartScopedFieldCount}</span>
        </div>
      </div>

      <p className="mt-4 rounded-xl border border-dashed border-[var(--border)] bg-slate-50 px-3 py-2 text-sm text-[var(--muted)]">
        Los campos protegidos se guardan de inmediato, pero su efecto real se adopta tras un
        reinicio controlado.
      </p>
    </article>
  );
}
