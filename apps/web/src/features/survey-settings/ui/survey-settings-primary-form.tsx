import { useEffect, useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { ApiError } from '../../../shared/http/api-client';
import { StateMessage } from '../../../shared/ui/state-messages';
import { SurveySettingsSection } from './survey-settings-section';
import { SurveySettingSelectField } from './survey-setting-select-field';
import {
  formatSurveyRuntimeAllowedRolesLabel,
  formatSurveyRuntimeSendModeLabel,
  type SurveyRuntimeSettings,
  type SurveyRuntimeSettingsOptions,
  type SurveyRuntimeSettingsUpdateRequest,
} from '../survey-settings.types';
import { useUpdateSurveyRuntimeSettingsMutation } from '../survey-settings.hooks';

interface SurveySettingsPrimaryFormProps {
  settings: SurveyRuntimeSettings;
  options: SurveyRuntimeSettingsOptions;
}

const PRIMARY_FIELD_KEYS = ['sendMode', 'sendRolloutPercent'] as const;

type PrimaryFormValues = {
  sendMode: SurveyRuntimeSettings['stored']['sendMode'];
  sendRolloutPercent: SurveyRuntimeSettings['stored']['sendRolloutPercent'];
};

export function SurveySettingsPrimaryForm({
  settings,
  options,
}: SurveySettingsPrimaryFormProps) {
  const updateMutation = useUpdateSurveyRuntimeSettingsMutation();
  const [values, setValues] = useState<PrimaryFormValues>({
    sendMode: settings.stored.sendMode,
    sendRolloutPercent: settings.stored.sendRolloutPercent,
  });
  const [feedback, setFeedback] = useState<{
    tone: 'neutral' | 'danger' | 'success';
    title: string;
    description?: string;
  } | null>(null);

  useEffect(() => {
    setValues({
      sendMode: settings.stored.sendMode,
      sendRolloutPercent: settings.stored.sendRolloutPercent,
    });
    setFeedback(null);
  }, [settings.metadata.version, settings.stored.sendMode, settings.stored.sendRolloutPercent]);

  const canEdit = settings.permissions.canEditPrimary;
  const fields = options.sections.primary.filter((field) =>
    PRIMARY_FIELD_KEYS.includes(field.key as (typeof PRIMARY_FIELD_KEYS)[number]),
  );

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFeedback(null);

    const payload: SurveyRuntimeSettingsUpdateRequest = {
      expectedVersion: settings.metadata.version,
      changes: {
        sendMode: values.sendMode,
        sendRolloutPercent: values.sendRolloutPercent,
      },
    };

    try {
      const updated = await updateMutation.mutateAsync(payload);
      setFeedback({
        tone: 'success',
        title: 'Controles primarios guardados.',
        description: `Version actualizada a #${updated.metadata.version}.`,
      });
      toast.success('Controles primarios guardados.');
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        setFeedback({
          tone: 'danger',
          title: 'Conflicto de version detectado.',
          description:
            'Otro operador guardo cambios antes de este intento. Refresca y vuelve a intentar.',
        });
        toast.warning('Conflicto de version. Refresca y vuelve a intentar.');
        return;
      }

      if (error instanceof ApiError) {
        setFeedback({
          tone: 'danger',
          title: 'No fue posible guardar controles primarios.',
          description: error.message,
        });
        toast.error(error.message);
        return;
      }

      setFeedback({
        tone: 'danger',
        title: 'No fue posible guardar controles primarios.',
        description: 'Intenta nuevamente en unos segundos.',
      });
      toast.error('No fue posible guardar controles primarios.');
    }
  };

  return (
    <SurveySettingsSection
      title="Controles primarios"
      description="Controla el modo de envio y el rollout de encuestas."
      summary="Modo, rollout y pausa separada."
    >
      {settings.stored.emergencyPauseEnabled === 'enabled' ? (
        <StateMessage
          title="La pausa de emergencia esta activa."
          description="El envio real queda detenido por seguridad operativa. Usa el bloque de pausa para reanudar."
          tone="warning"
        />
      ) : null}

      <form className="space-y-4" onSubmit={onSubmit}>
        {fields.map((field) => {
          const fieldKey = field.key as (typeof PRIMARY_FIELD_KEYS)[number];

          return (
            <SurveySettingSelectField
              key={fieldKey}
              id={`survey-setting-${fieldKey}`}
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
              readOnlyNote={formatSurveyRuntimeAllowedRolesLabel(field.editableByRoles)}
              helperText={
                fieldKey === 'sendMode'
                  ? `Ejecucion actual: ${formatSurveyRuntimeSendModeLabel(values.sendMode)}.`
                  : `Rollout actual: ${values.sendRolloutPercent}%.`
              }
            />
          );
        })}

        <div className="grid gap-3 rounded-2xl border border-[var(--border)] bg-[var(--panel-muted)] p-4 sm:grid-cols-2">
          <div>
            <p className="text-xs uppercase tracking-[0.12em] text-[var(--muted)]">Guardado</p>
            <p className="mt-1 text-sm font-medium text-[var(--text)]">
              {formatSurveyRuntimeSendModeLabel(settings.stored.sendMode)} /{' '}
              {settings.stored.sendRolloutPercent}%
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.12em] text-[var(--muted)]">Efectivo</p>
            <p className="mt-1 text-sm font-medium text-[var(--text)]">
              {settings.stored.emergencyPauseEnabled === 'enabled'
                ? 'Pausado por emergencia'
                : `${formatSurveyRuntimeSendModeLabel(settings.effectiveHotReloadable.sendMode)} / ${settings.effectiveHotReloadable.sendRolloutPercent}%`}
            </p>
          </div>
        </div>

        <StateMessage
          title="Pausa de emergencia separada."
          description="La pausa se controla desde su tarjeta dedicada para mantener el cambio explícito y auditable."
          tone="neutral"
        />

        {feedback ? (
          <StateMessage
            title={feedback.title}
            description={feedback.description}
            tone={feedback.tone}
          />
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-[var(--muted)]">
            El guardado queda versionado y auditado.
          </p>
          <button
            type="submit"
            disabled={!canEdit || updateMutation.isPending}
            className="inline-flex items-center justify-center rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {updateMutation.isPending ? 'Guardando...' : 'Guardar controles primarios'}
          </button>
        </div>
      </form>
    </SurveySettingsSection>
  );
}
