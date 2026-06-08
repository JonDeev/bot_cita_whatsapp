import { useEffect, useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { ApiError } from '../../../shared/http/api-client';
import { StateMessage } from '../../../shared/ui/state-messages';
import { ReminderSettingsSection } from './reminder-settings-section';
import { ReminderSettingSelectField } from './reminder-setting-select-field';
import {
  formatReminderRuntimeAllowedRolesLabel,
  type ReminderRuntimeSettingsUpdateRequest,
  type ReminderRuntimeSettings,
  type ReminderRuntimeSettingsOptions,
} from '../reminder-settings.types';
import { useUpdateReminderRuntimeSettingsMutation } from '../reminder-settings.hooks';

interface ReminderSettingsProtectedFormProps {
  settings: ReminderRuntimeSettings;
  options: ReminderRuntimeSettingsOptions;
}

const PROTECTED_FIELD_KEYS = [
  'syncEnabled',
  'dispatchEnabled',
  'queueEnabled',
  'syncIntervalMs',
  'recoverySweepIntervalMs',
  'workerConcurrency',
  'lockTtlSeconds',
  'lockHeartbeatIntervalMs',
  'minConfirmationHours',
] as const;
type ProtectedFormValues = {
  syncEnabled: ReminderRuntimeSettings['stored']['syncEnabled'];
  dispatchEnabled: ReminderRuntimeSettings['stored']['dispatchEnabled'];
  queueEnabled: ReminderRuntimeSettings['stored']['queueEnabled'];
  syncIntervalMs: ReminderRuntimeSettings['stored']['syncIntervalMs'];
  recoverySweepIntervalMs: ReminderRuntimeSettings['stored']['recoverySweepIntervalMs'];
  workerConcurrency: ReminderRuntimeSettings['stored']['workerConcurrency'];
  lockTtlSeconds: ReminderRuntimeSettings['stored']['lockTtlSeconds'];
  lockHeartbeatIntervalMs: ReminderRuntimeSettings['stored']['lockHeartbeatIntervalMs'];
  minConfirmationHours: ReminderRuntimeSettings['stored']['minConfirmationHours'];
};

export function ReminderSettingsProtectedForm({
  settings,
  options,
}: ReminderSettingsProtectedFormProps) {
  const updateMutation = useUpdateReminderRuntimeSettingsMutation();
  const [values, setValues] = useState<ProtectedFormValues>({
    syncEnabled: settings.stored.syncEnabled,
    dispatchEnabled: settings.stored.dispatchEnabled,
    queueEnabled: settings.stored.queueEnabled,
    syncIntervalMs: settings.stored.syncIntervalMs,
    recoverySweepIntervalMs: settings.stored.recoverySweepIntervalMs,
    workerConcurrency: settings.stored.workerConcurrency,
    lockTtlSeconds: settings.stored.lockTtlSeconds,
    lockHeartbeatIntervalMs: settings.stored.lockHeartbeatIntervalMs,
    minConfirmationHours: settings.stored.minConfirmationHours,
  });
  const [reason, setReason] = useState('');
  const [acknowledged, setAcknowledged] = useState(false);
  const [feedback, setFeedback] = useState<{
    tone: 'neutral' | 'danger' | 'success';
    title: string;
    description?: string;
  } | null>(null);

  useEffect(() => {
    setValues({
      syncEnabled: settings.stored.syncEnabled,
      dispatchEnabled: settings.stored.dispatchEnabled,
      queueEnabled: settings.stored.queueEnabled,
      syncIntervalMs: settings.stored.syncIntervalMs,
      recoverySweepIntervalMs: settings.stored.recoverySweepIntervalMs,
      workerConcurrency: settings.stored.workerConcurrency,
      lockTtlSeconds: settings.stored.lockTtlSeconds,
      lockHeartbeatIntervalMs: settings.stored.lockHeartbeatIntervalMs,
      minConfirmationHours: settings.stored.minConfirmationHours,
    });
    setReason('');
    setAcknowledged(false);
    setFeedback(null);
  }, [
    settings.metadata.version,
    settings.stored.dispatchEnabled,
    settings.stored.lockHeartbeatIntervalMs,
    settings.stored.lockTtlSeconds,
    settings.stored.minConfirmationHours,
    settings.stored.queueEnabled,
    settings.stored.recoverySweepIntervalMs,
    settings.stored.syncEnabled,
    settings.stored.syncIntervalMs,
    settings.stored.workerConcurrency,
  ]);

  const canEdit = settings.permissions.canEditProtected;
  const protectedFields = options.sections.protected.filter((field) =>
    PROTECTED_FIELD_KEYS.includes(field.key as (typeof PROTECTED_FIELD_KEYS)[number]),
  );

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFeedback(null);

    if (!acknowledged) {
      setFeedback({
        tone: 'danger',
        title: 'Confirma la operacion antes de guardar.',
        description: 'Debes marcar la confirmacion explicita para cambios protegidos.',
      });
      return;
    }

    if (!reason.trim()) {
      setFeedback({
        tone: 'danger',
        title: 'La razon es obligatoria.',
        description: 'Describe por que este cambio protegido es necesario.',
      });
      return;
    }

    const trimmedReason = reason.trim();

    const payload: ReminderRuntimeSettingsUpdateRequest = {
      expectedVersion: settings.metadata.version,
      reason: trimmedReason,
      changes: values,
    };

    try {
      const updated = await updateMutation.mutateAsync(payload);
      setFeedback({
        tone: 'success',
        title: 'Configuracion protegida guardada.',
        description: `Version actualizada a #${updated.metadata.version}.`,
      });
      toast.success('Configuracion protegida guardada.');
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        setFeedback({
          tone: 'danger',
          title: 'Conflicto de version detectado.',
          description: 'Otra persona guardo cambios antes de este intento. Refresca y vuelve a revisar.',
        });
        toast.warning('Conflicto de version. Refresca y vuelve a intentar.');
        return;
      }

      if (error instanceof ApiError) {
        setFeedback({
          tone: 'danger',
          title: 'No fue posible guardar la configuracion protegida.',
          description: error.message,
        });
        toast.error(error.message);
        return;
      }

      setFeedback({
        tone: 'danger',
        title: 'No fue posible guardar la configuracion protegida.',
        description: 'Intenta nuevamente en unos segundos.',
      });
      toast.error('No fue posible guardar la configuracion protegida.');
    }
  };

  return (
    <ReminderSettingsSection
      title="Configuracion protegida"
      description="Parametros sensibles del motor y guardrails de despacho."
      summary="Solo ADMIN y con reinicio controlado en varios campos."
      tone="warning"
      collapsible
      defaultOpen={false}
    >
      <StateMessage
        title="Campos sensibles: revisa antes de guardar."
        description="La edicion exige confirmacion explicita y una razon."
        tone="warning"
      />

      {!canEdit ? (
        <StateMessage
          title="Solo ADMIN puede modificar esta seccion."
          description="La vista se mantiene para lectura y auditoria."
          tone="warning"
        />
      ) : null}

      <form className="space-y-4" onSubmit={onSubmit}>
        {protectedFields.map((field) => {
          const fieldKey = field.key as (typeof PROTECTED_FIELD_KEYS)[number];

          return (
            <ReminderSettingSelectField
              key={fieldKey}
              id={`reminder-setting-${fieldKey}`}
              label={field.label}
              description={field.description}
              value={values[fieldKey]}
              onValueChange={(nextValue) =>
                setValues((current) => ({ ...current, [fieldKey]: nextValue }))
              }
              allowedValues={field.allowedValues}
              applyMode={field.applyMode}
              warningText={field.warningText}
              disabled={!canEdit || updateMutation.isPending}
              readOnlyNote={formatReminderRuntimeAllowedRolesLabel(field.editableByRoles)}
              helperText={
                field.applyMode === 'restart_required'
                  ? 'Se aplica con reinicio controlado.'
                  : 'Se aplica en el siguiente ciclo.'
              }
            />
          );
        })}

        <div className="grid gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <label className="block">
            <span className="text-sm font-semibold text-amber-950">Razon del cambio</span>
            <textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              disabled={!canEdit || updateMutation.isPending}
              rows={3}
              className="mt-2 w-full rounded-xl border border-amber-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-500/30 disabled:cursor-not-allowed disabled:bg-slate-50"
              placeholder="Explica por que este cambio es necesario."
            />
          </label>

          <label className="flex items-start gap-3 rounded-xl border border-amber-200 bg-white px-3 py-3 text-sm text-amber-950">
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={(event) => setAcknowledged(event.target.checked)}
              disabled={!canEdit || updateMutation.isPending}
              className="mt-1 h-4 w-4 rounded border-amber-300"
            />
            <span>
              Confirmo que entiendo el impacto de estos campos y que pueden requerir reinicio
              controlado.
            </span>
          </label>

          {!reason.trim() ? (
            <p className="text-xs text-amber-900">La razon es obligatoria para guardar.</p>
          ) : null}
        </div>

        <div className="grid gap-3 rounded-2xl border border-[var(--border)] bg-[var(--panel-muted)] p-4 sm:grid-cols-2">
          <div>
            <p className="text-xs uppercase tracking-[0.12em] text-[var(--muted)]">Guardado</p>
            <p className="mt-1 text-sm font-medium text-[var(--text)]">
              {settings.stored.syncEnabled}, {settings.stored.dispatchEnabled},{' '}
              {settings.stored.queueEnabled}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.12em] text-[var(--muted)]">Aplicacion</p>
            <p className="mt-1 text-sm font-medium text-[var(--text)]">
              {settings.runtimeApplication.restartScopedApplyNote}
            </p>
          </div>
        </div>

        {feedback ? (
          <StateMessage
            title={feedback.title}
            description={feedback.description}
            tone={feedback.tone}
          />
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-[var(--muted)]">
            El guardado queda auditado con version, autor y razon.
          </p>
          <button
            type="submit"
            disabled={!canEdit || updateMutation.isPending}
            className="inline-flex items-center justify-center rounded-xl bg-amber-600 px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {updateMutation.isPending ? 'Guardando...' : 'Guardar configuracion protegida'}
          </button>
        </div>
      </form>
    </ReminderSettingsSection>
  );
}
