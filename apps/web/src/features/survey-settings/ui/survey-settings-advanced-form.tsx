import { useEffect, useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { ApiError } from '../../../shared/http/api-client';
import { StateMessage } from '../../../shared/ui/state-messages';
import { SurveySettingsSection } from './survey-settings-section';
import { SurveySettingSelectField } from './survey-setting-select-field';
import {
  formatSurveyRuntimeAllowedRolesLabel,
  formatSurveyRuntimeScheduleProfileLabel,
  type SurveyRuntimeSettings,
  type SurveyRuntimeSettingsOptions,
  type SurveyRuntimeSettingsUpdateRequest,
} from '../survey-settings.types';
import { useUpdateSurveyRuntimeSettingsMutation } from '../survey-settings.hooks';

interface SurveySettingsAdvancedFormProps {
  settings: SurveyRuntimeSettings;
  options: SurveyRuntimeSettingsOptions;
}

const ADVANCED_FIELD_KEYS = [
  'dispatchEnabled',
  'eligibilityLimit',
  'expirationHours',
  'scheduleProfile',
] as const;

type AdvancedFormValues = {
  dispatchEnabled: SurveyRuntimeSettings['stored']['dispatchEnabled'];
  eligibilityLimit: SurveyRuntimeSettings['stored']['eligibilityLimit'];
  expirationHours: SurveyRuntimeSettings['stored']['expirationHours'];
  scheduleProfile: SurveyRuntimeSettings['stored']['scheduleProfile'];
};

export function SurveySettingsAdvancedForm({
  settings,
  options,
}: SurveySettingsAdvancedFormProps) {
  const updateMutation = useUpdateSurveyRuntimeSettingsMutation();
  const [values, setValues] = useState<AdvancedFormValues>({
    dispatchEnabled: settings.stored.dispatchEnabled,
    eligibilityLimit: settings.stored.eligibilityLimit,
    expirationHours: settings.stored.expirationHours,
    scheduleProfile: settings.stored.scheduleProfile,
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
      dispatchEnabled: settings.stored.dispatchEnabled,
      eligibilityLimit: settings.stored.eligibilityLimit,
      expirationHours: settings.stored.expirationHours,
      scheduleProfile: settings.stored.scheduleProfile,
    });
    setReason('');
    setAcknowledged(false);
    setFeedback(null);
  }, [
    settings.metadata.version,
    settings.stored.dispatchEnabled,
    settings.stored.eligibilityLimit,
    settings.stored.expirationHours,
    settings.stored.scheduleProfile,
  ]);

  const canEdit = settings.permissions.canEditAdvanced;
  const fields = options.sections.advanced.filter((field) =>
    ADVANCED_FIELD_KEYS.includes(field.key as (typeof ADVANCED_FIELD_KEYS)[number]),
  );

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFeedback(null);

    if (!acknowledged) {
      setFeedback({
        tone: 'danger',
        title: 'Confirma la operacion antes de guardar.',
        description:
          'Debes marcar la confirmacion explicita para cambios de configuracion avanzada.',
      });
      return;
    }

    if (!reason.trim()) {
      setFeedback({
        tone: 'danger',
        title: 'La razon es obligatoria.',
        description: 'Describe por que este cambio es necesario.',
      });
      return;
    }

    const payload: SurveyRuntimeSettingsUpdateRequest = {
      expectedVersion: settings.metadata.version,
      reason: reason.trim(),
      changes: values,
    };

    try {
      const updated = await updateMutation.mutateAsync(payload);
      setFeedback({
        tone: 'success',
        title: 'Configuracion avanzada guardada.',
        description: `Version actualizada a #${updated.metadata.version}.`,
      });
      toast.success('Configuracion avanzada guardada.');
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        setFeedback({
          tone: 'danger',
          title: 'Conflicto de version detectado.',
          description:
            'Otra persona guardo cambios antes de este intento. Refresca y vuelve a revisar.',
        });
        toast.warning('Conflicto de version. Refresca y vuelve a intentar.');
        return;
      }

      if (error instanceof ApiError) {
        setFeedback({
          tone: 'danger',
          title: 'No fue posible guardar la configuracion avanzada.',
          description: error.message,
        });
        toast.error(error.message);
        return;
      }

      setFeedback({
        tone: 'danger',
        title: 'No fue posible guardar la configuracion avanzada.',
        description: 'Intenta nuevamente en unos segundos.',
      });
      toast.error('No fue posible guardar la configuracion avanzada.');
    }
  };

  return (
    <SurveySettingsSection
      title="Configuracion avanzada"
      description="Controles de cadencia y volumen para la operacion tecnica."
      summary="Guardrails de procesamiento."
      collapsible
      defaultOpen={false}
    >
      {!canEdit ? (
        <StateMessage
          title="Solo ADMIN puede modificar esta seccion."
          description="La vista se mantiene disponible para lectura y auditoria."
          tone="warning"
        />
      ) : null}

      <form className="space-y-4" onSubmit={onSubmit}>
        {fields.map((field) => {
          const fieldKey = field.key as (typeof ADVANCED_FIELD_KEYS)[number];

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
                fieldKey === 'scheduleProfile'
                  ? `Perfil activo: ${formatSurveyRuntimeScheduleProfileLabel(values.scheduleProfile)}.`
                  : fieldKey === 'dispatchEnabled'
                    ? `Despacho actual: ${
                        values.dispatchEnabled === 'enabled' ? 'habilitado' : 'deshabilitado'
                      }.`
                    : fieldKey === 'eligibilityLimit'
                      ? 'Límite máximo de candidatos evaluados por corrida.'
                      : 'Horas de vigencia para cada despacho.'
              }
            />
          );
        })}

        <div className="grid gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <label className="block">
            <span className="text-sm font-semibold text-amber-950">Razón del cambio</span>
            <textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              disabled={!canEdit || updateMutation.isPending}
              rows={3}
              className="mt-2 w-full rounded-xl border border-amber-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-500/30 disabled:cursor-not-allowed disabled:bg-slate-50"
              placeholder="Explica por qué este cambio es necesario."
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
              Confirmo que entiendo el impacto operativo de estos campos y que pueden modificar
              el ritmo del despachador.
            </span>
          </label>

          {!reason.trim() ? (
            <p className="text-xs text-amber-900">La razón es obligatoria para guardar.</p>
          ) : null}
        </div>

        <div className="grid gap-3 rounded-2xl border border-[var(--border)] bg-[var(--panel-muted)] p-4 sm:grid-cols-2">
          <div>
            <p className="text-xs uppercase tracking-[0.12em] text-[var(--muted)]">Guardado</p>
            <p className="mt-1 text-sm font-medium text-[var(--text)]">
              {values.dispatchEnabled === 'enabled' ? 'Habilitado' : 'Deshabilitado'},{' '}
              {values.eligibilityLimit}, {values.expirationHours}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.12em] text-[var(--muted)]">Perfil</p>
            <p className="mt-1 text-sm font-medium text-[var(--text)]">
              {formatSurveyRuntimeScheduleProfileLabel(values.scheduleProfile)}
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
            Los cambios sensibles quedan auditados con versión, autor y razón.
          </p>
          <button
            type="submit"
            disabled={!canEdit || updateMutation.isPending}
            className="inline-flex items-center justify-center rounded-xl bg-amber-600 px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {updateMutation.isPending ? 'Guardando...' : 'Guardar configuracion avanzada'}
          </button>
        </div>
      </form>
    </SurveySettingsSection>
  );
}
