import { AlertTriangle, ShieldAlert, ShieldCheck } from 'lucide-react';
import { formatDateTime } from '../../../shared/intl/date';
import type {
  ReminderRuntimeSettingHistoryItem,
  ReminderRuntimeSettings,
} from '../reminder-settings.types';

interface EmergencyPauseBannerProps {
  settings: ReminderRuntimeSettings;
  latestHistoryItem?: ReminderRuntimeSettingHistoryItem | null;
}

export function EmergencyPauseBanner({
  settings,
  latestHistoryItem,
}: EmergencyPauseBannerProps) {
  const isPaused = settings.stored.emergencyPauseEnabled === 'enabled';
  const hasPersistedSettings = settings.metadata.version > 0;
  const latestReason = settings.metadata.emergencyPauseReason ?? latestHistoryItem?.reason;
  const latestActor = latestHistoryItem?.actor.displayName ?? latestHistoryItem?.actor.username;

  return (
    <article
      className={`rounded-2xl border p-4 shadow-sm ${
        isPaused
          ? 'border-amber-300 bg-amber-50'
          : 'border-emerald-200 bg-emerald-50/70'
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`rounded-full p-2 ${
            isPaused ? 'bg-amber-100 text-amber-900' : 'bg-emerald-100 text-emerald-900'
          }`}
        >
          {isPaused ? <ShieldAlert size={18} /> : <ShieldCheck size={18} />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs uppercase tracking-[0.14em] text-[var(--muted)]">
            Pausa de emergencia
          </p>
          <h2 className="mt-1 text-lg font-semibold text-[var(--text)]">
            {isPaused ? 'Envios reales detenidos' : 'Operacion estable'}
          </h2>
          <p className="mt-2 text-sm text-[var(--muted)]">
            {isPaused
              ? 'La configuracion se mantiene, pero el envio real queda bloqueado hasta que se levante la pausa.'
              : 'El envio sigue las reglas guardadas y el rollout vigente.'}
          </p>
        </div>
      </div>

      {isPaused ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-amber-200 bg-white/80 px-3 py-2">
            <p className="text-xs uppercase tracking-[0.12em] text-[var(--muted)]">Motivo</p>
            <p className="mt-1 text-sm font-medium text-[var(--text)]">
              {latestReason ?? 'No registrado'}
            </p>
          </div>
          <div className="rounded-xl border border-amber-200 bg-white/80 px-3 py-2">
            <p className="text-xs uppercase tracking-[0.12em] text-[var(--muted)]">Registrado por</p>
            <p className="mt-1 text-sm font-medium text-[var(--text)]">
              {latestActor
                ? latestActor
                : hasPersistedSettings && settings.metadata.lastUpdatedByAdminUserId
                  ? `Administrador #${settings.metadata.lastUpdatedByAdminUserId}`
                  : 'Bootstrap'}
            </p>
            <p className="mt-1 text-xs text-[var(--muted)]">
              {latestHistoryItem
                ? formatDateTime(latestHistoryItem.occurredAtIso)
                : hasPersistedSettings
                  ? formatDateTime(settings.metadata.lastUpdatedAtIso)
                  : 'Sin historial aún'}
            </p>
          </div>
        </div>
      ) : (
        <div className="mt-4 rounded-xl border border-emerald-200 bg-white/80 px-3 py-2 text-sm text-[var(--muted)]">
          Si activas una pausa, aqui veras el motivo, el autor y la hora del ultimo cambio.
        </div>
      )}
    </article>
  );
}
