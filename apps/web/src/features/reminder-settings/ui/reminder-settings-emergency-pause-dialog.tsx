import { X } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { ApiError } from '../../../shared/http/api-client';
import { StateMessage } from '../../../shared/ui/state-messages';
import { formatReminderRuntimeSendModeLabel } from '../reminder-settings.types';
import type { ReminderRuntimeSettings } from '../reminder-settings.types';
import { useToggleReminderEmergencyPauseMutation } from '../reminder-settings.hooks';

interface ReminderSettingsEmergencyPauseDialogProps {
  settings: ReminderRuntimeSettings;
  open: boolean;
  targetEnabled: boolean;
  onClose: () => void;
}

export function ReminderSettingsEmergencyPauseDialog({
  settings,
  open,
  targetEnabled,
  onClose,
}: ReminderSettingsEmergencyPauseDialogProps) {
  const toggleMutation = useToggleReminderEmergencyPauseMutation();
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
  }, [open, targetEnabled]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose, open]);

  if (!open) {
    return null;
  }

  const actionLabel = targetEnabled ? 'Activar pausa' : 'Levantar pausa';

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFeedback(null);

    if (!acknowledged) {
      setFeedback({
        tone: 'danger',
        title: 'Debes confirmar la operacion.',
        description: 'Marca la confirmacion explicita antes de continuar.',
      });
      return;
    }

    if (!reason.trim()) {
      setFeedback({
        tone: 'danger',
        title: 'La razon es obligatoria.',
        description: 'Describe el incidente o el motivo operativo antes de continuar.',
      });
      return;
    }

    try {
      const updated = await toggleMutation.mutateAsync({
        expectedVersion: settings.metadata.version,
        reason,
        emergencyPauseEnabled: targetEnabled ? 'enabled' : 'disabled',
      });

      setFeedback({
        tone: 'success',
        title: targetEnabled ? 'Pausa activada.' : 'Pausa levantada.',
        description: `Version actualizada a #${updated.metadata.version}.`,
      });
      toast.success(targetEnabled ? 'Pausa activada.' : 'Pausa levantada.');
      onClose();
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        setFeedback({
          tone: 'danger',
          title: 'Conflicto de version detectado.',
          description: 'Refresca y vuelve a intentar la accion de pausa.',
        });
        toast.warning('Conflicto de version. Refresca y vuelve a intentar.');
        return;
      }

      if (error instanceof ApiError) {
        setFeedback({
          tone: 'danger',
          title: 'No fue posible cambiar la pausa de emergencia.',
          description: error.message,
        });
        toast.error(error.message);
        return;
      }

      setFeedback({
        tone: 'danger',
        title: 'No fue posible cambiar la pausa de emergencia.',
        description: 'Intenta nuevamente en unos segundos.',
      });
      toast.error('No fue posible cambiar la pausa de emergencia.');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-lg rounded-3xl border border-[var(--border)] bg-[var(--panel)] p-5 shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="reminder-emergency-pause-title"
        aria-describedby="reminder-emergency-pause-description"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--accent)]">
              Pausa de emergencia
            </p>
            <h2
              id="reminder-emergency-pause-title"
              className="mt-2 text-xl font-semibold tracking-tight"
            >
              {targetEnabled ? 'Activar pausa' : 'Levantar pausa'}
            </h2>
            <p
              id="reminder-emergency-pause-description"
              className="mt-2 text-sm text-[var(--muted)]"
            >
              {targetEnabled
                ? 'Detiene los envios reales sin perder la configuracion almacenada.'
                : 'Reanuda el envio con la configuracion guardada.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-[var(--border)] p-2 text-[var(--muted)] hover:bg-slate-50"
            aria-label="Cerrar dialogo"
          >
            <X size={16} />
          </button>
        </div>

        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          Estado guardado: {formatReminderRuntimeSendModeLabel(settings.stored.sendMode)} con
          rollout {settings.stored.sendRolloutPercent}%.
        </div>

        <form className="mt-4 space-y-4" onSubmit={onSubmit}>
          <label className="block">
            <span className="text-sm font-semibold">Razon de la accion</span>
            <textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={3}
              className="mt-2 w-full rounded-xl border border-[var(--border)] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-teal-500/30"
              placeholder="Explica el motivo operativo."
            />
          </label>

          <label className="flex items-start gap-3 rounded-xl border border-[var(--border)] bg-slate-50 px-3 py-3 text-sm">
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={(event) => setAcknowledged(event.target.checked)}
              className="mt-1 h-4 w-4 rounded border-slate-300"
            />
            <span>
              Confirmo que entiendo el impacto de {actionLabel.toLowerCase()} y que la accion
              debe quedar auditada.
            </span>
          </label>

          {feedback ? (
            <StateMessage
              title={feedback.title}
              description={feedback.description}
              tone={feedback.tone}
            />
          ) : null}

          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-medium hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={toggleMutation.isPending}
              className="rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {toggleMutation.isPending ? 'Procesando...' : actionLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
