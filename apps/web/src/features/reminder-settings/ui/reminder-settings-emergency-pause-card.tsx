import { ShieldAlert, ShieldCheck } from 'lucide-react';
import type { ReminderRuntimeSettings } from '../reminder-settings.types';

interface ReminderSettingsEmergencyPauseCardProps {
  settings: ReminderRuntimeSettings;
  canToggle: boolean;
  onOpenDialog: (targetEnabled: boolean) => void;
}

export function ReminderSettingsEmergencyPauseCard({
  settings,
  canToggle,
  onOpenDialog,
}: ReminderSettingsEmergencyPauseCardProps) {
  const isPaused = settings.stored.emergencyPauseEnabled === 'enabled';

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
          <h2 className="mt-1 text-lg font-semibold">
            {isPaused ? 'Pausa activa' : 'Operacion normal'}
          </h2>
          <p className="mt-2 text-sm text-[var(--muted)]">
            {isPaused
              ? 'Los envios reales quedan retenidos hasta que se levante la pausa.'
              : 'La operacion sigue las reglas guardadas y el rollout vigente.'}
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onOpenDialog(!isPaused)}
          disabled={!canToggle}
          className="rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPaused ? 'Levantar pausa' : 'Activar pausa'}
        </button>
        {!canToggle ? (
          <span className="rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-xs text-[var(--muted)]">
            Accion reservada por rol.
          </span>
        ) : null}
      </div>
    </article>
  );
}
