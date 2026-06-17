import { AlertTriangle } from 'lucide-react';
import { StateMessage } from '../../../shared/ui/state-messages';
import { formatSurveyRuntimeSendModeLabel, type SurveyRuntimeSettings } from '../survey-settings.types';

interface SurveySettingsEmergencyPauseCardProps {
  settings: SurveyRuntimeSettings;
  canToggle: boolean;
  onOpenDialog: (targetEnabled: boolean) => void;
}

export function SurveySettingsEmergencyPauseCard({
  settings,
  canToggle,
  onOpenDialog,
}: SurveySettingsEmergencyPauseCardProps) {
  const isPaused = settings.stored.emergencyPauseEnabled === 'enabled';

  return (
    <article className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.14em] text-[var(--muted)]">
            Pausa de emergencia
          </p>
          <h2 className="mt-1 text-lg font-semibold">
            {isPaused ? 'Pausa activa' : 'Operación normal'}
          </h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {isPaused
              ? 'Los envíos reales están detenidos mientras se revisa la operación.'
              : 'La operación continúa con el modo guardado y el rollout vigente.'}
          </p>
        </div>
        <div className="rounded-2xl bg-amber-50 p-2 text-amber-700">
          <AlertTriangle size={18} />
        </div>
      </div>

      <div className="mt-4 grid gap-3 rounded-2xl bg-[var(--panel-muted)] p-3 text-sm sm:grid-cols-2">
        <div>
          <p className="text-xs uppercase tracking-[0.12em] text-[var(--muted)]">Modo guardado</p>
          <p className="mt-1 font-semibold">
            {formatSurveyRuntimeSendModeLabel(settings.stored.sendMode)} /{' '}
            {settings.stored.sendRolloutPercent}%
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.12em] text-[var(--muted)]">Estado</p>
          <p className="mt-1 font-semibold">
            {isPaused ? 'Envíos reales detenidos' : 'Sin override'}
          </p>
        </div>
      </div>

      {!canToggle ? (
        <div className="mt-4">
          <StateMessage
            title="Solo ADMIN puede cambiar la pausa."
            description="La tarjeta sigue visible para supervisión operativa."
            tone="warning"
          />
        </div>
      ) : null}

      {canToggle ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onOpenDialog(!isPaused)}
            className={`inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110 ${
              isPaused ? 'bg-emerald-600' : 'bg-amber-600'
            }`}
          >
            {isPaused ? 'Reanudar envíos' : 'Pausar envíos'}
          </button>
        </div>
      ) : null}
    </article>
  );
}
