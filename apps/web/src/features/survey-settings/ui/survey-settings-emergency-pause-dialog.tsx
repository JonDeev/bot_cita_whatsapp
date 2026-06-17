import { useEffect, useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { ApiError } from '../../../shared/http/api-client';
import { StateMessage } from '../../../shared/ui/state-messages';
import {
  formatSurveyRuntimeSendModeLabel,
  type SurveyEmergencyPauseUpdateRequest,
  type SurveyRuntimeSettings,
} from '../survey-settings.types';
import { useToggleSurveyEmergencyPauseMutation } from '../survey-settings.hooks';

interface SurveySettingsEmergencyPauseDialogProps {
  settings: SurveyRuntimeSettings;
  open: boolean;
  targetEnabled: boolean;
  onClose: () => void;
}

export function SurveySettingsEmergencyPauseDialog({
  settings,
  open,
  targetEnabled,
  onClose,
}: SurveySettingsEmergencyPauseDialogProps) {
  const toggleMutation = useToggleSurveyEmergencyPauseMutation();
  const [reason, setReason] = useState('');
  const [acknowledged, setAcknowledged] = useState(false);
  const [feedback, setFeedback] = useState<{
    tone: 'neutral' | 'danger' | 'success';
    title: string;
    description?: string;
  } | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    setReason('');
    setAcknowledged(false);
    setFeedback(null);
  }, [open, settings.metadata.version, targetEnabled]);

  if (!open) {
    return null;
  }

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFeedback(null);

    if (!acknowledged) {
      setFeedback({
        tone: 'danger',
        title: 'Confirma la operación antes de continuar.',
        description: 'Debes marcar la confirmación explícita para esta acción sensible.',
      });
      return;
    }

    if (!reason.trim()) {
      setFeedback({
        tone: 'danger',
        title: 'La razón es obligatoria.',
        description: 'Describe por qué esta pausa o reanudación es necesaria.',
      });
      return;
    }

    const payload: SurveyEmergencyPauseUpdateRequest = {
      expectedVersion: settings.metadata.version,
      reason: reason.trim(),
      emergencyPauseEnabled: targetEnabled ? 'enabled' : 'disabled',
    };

    try {
      await toggleMutation.mutateAsync(payload);
      toast.success(
        targetEnabled ? 'Pausa de emergencia activada.' : 'Pausa de emergencia desactivada.',
      );
      onClose();
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        setFeedback({
          tone: 'danger',
          title: 'Conflicto de version detectado.',
          description:
            'Otro operador cambió la pausa antes de este intento. Refresca y vuelve a intentar.',
        });
        toast.warning('Conflicto de version. Refresca y vuelve a intentar.');
        return;
      }

      if (error instanceof ApiError) {
        setFeedback({
          tone: 'danger',
          title: 'No fue posible actualizar la pausa.',
          description: error.message,
        });
        toast.error(error.message);
        return;
      }

      setFeedback({
        tone: 'danger',
        title: 'No fue posible actualizar la pausa.',
        description: 'Intenta nuevamente en unos segundos.',
      });
      toast.error('No fue posible actualizar la pausa.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-3 backdrop-blur-sm md:items-center">
      <div className="w-full max-w-2xl rounded-3xl border border-[var(--border)] bg-[var(--panel)] p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.14em] text-[var(--muted)]">
              Pausa de emergencia
            </p>
            <h2 className="mt-1 text-xl font-semibold tracking-tight">
              {targetEnabled ? 'Activar pausa' : 'Reanudar envíos'}
            </h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              {targetEnabled
                ? 'Esto bloqueará los envíos reales sin modificar el flujo operativo del panel.'
                : 'Esto reanudará los envíos reales bajo la configuración almacenada.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-[var(--border)] bg-white px-3 py-1.5 text-sm font-medium text-[var(--text)]"
          >
            Cerrar
          </button>
        </div>

        <div className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--panel-muted)] p-3 text-sm">
          <p className="font-medium">
            Estado actual: {formatSurveyRuntimeSendModeLabel(settings.stored.sendMode)} /{' '}
            {settings.stored.sendRolloutPercent}%
          </p>
          <p className="mt-1 text-[var(--muted)]">
            La acción quedará auditada con versión, autor y razón.
          </p>
        </div>

        <form className="mt-4 space-y-4" onSubmit={onSubmit}>
          <label className="block">
            <span className="text-sm font-semibold text-[var(--text)]">Razón</span>
            <textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              disabled={toggleMutation.isPending}
              rows={4}
              className="mt-2 w-full rounded-xl border border-[var(--border)] bg-[var(--panel)] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-500/30 disabled:cursor-not-allowed disabled:bg-slate-50"
              placeholder="Explica por qué esta operación es necesaria."
            />
          </label>

          <label className="flex items-start gap-3 rounded-xl border border-[var(--border)] bg-white px-3 py-3 text-sm">
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={(event) => setAcknowledged(event.target.checked)}
              disabled={toggleMutation.isPending}
              className="mt-1 h-4 w-4 rounded border-[var(--border)]"
            />
            <span>
              Confirmo que entiendo el impacto de esta acción y que el cambio debe quedar
              registrado.
            </span>
          </label>

          {feedback ? (
            <StateMessage
              title={feedback.title}
              description={feedback.description}
              tone={feedback.tone}
            />
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-[var(--muted)]">
              {targetEnabled
                ? 'La pausa detendrá los envíos reales.'
                : 'La reanudación volverá a permitir envíos reales.'}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="inline-flex items-center justify-center rounded-xl border border-[var(--border)] bg-white px-4 py-2 text-sm font-semibold text-[var(--text)]"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={toggleMutation.isPending}
                className={`inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60 ${
                  targetEnabled ? 'bg-amber-600' : 'bg-emerald-600'
                }`}
              >
                {toggleMutation.isPending
                  ? 'Guardando...'
                  : targetEnabled
                    ? 'Activar pausa'
                    : 'Reanudar envíos'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
