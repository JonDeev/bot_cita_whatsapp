import { ChevronDown } from 'lucide-react';
import type { ReminderRuntimeSettingOption } from '../reminder-settings.types';
import { formatReminderRuntimeApplyModeLabel } from '../reminder-settings.types';

interface ReminderSettingSelectFieldProps {
  id: string;
  label: string;
  description: string;
  value: string;
  onValueChange?: (value: string) => void;
  allowedValues: ReminderRuntimeSettingOption['allowedValues'];
  applyMode: ReminderRuntimeSettingOption['applyMode'];
  warningText: string | null;
  readOnlyNote?: string;
  helperText?: string;
  disabled?: boolean;
}

export function ReminderSettingSelectField({
  id,
  label,
  description,
  value,
  onValueChange,
  allowedValues,
  applyMode,
  warningText,
  readOnlyNote,
  helperText,
  disabled = true,
}: ReminderSettingSelectFieldProps) {
  const isReadOnly = disabled || !onValueChange;

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-white/80 p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <label htmlFor={id} className="text-sm font-semibold text-[var(--text)]">
            {label}
          </label>
          <p className="mt-1 text-sm text-[var(--muted)]">{description}</p>
        </div>
        <span className="rounded-full border border-[var(--border)] bg-[var(--panel-muted)] px-2.5 py-1 text-[11px] font-medium text-[var(--muted)]">
          {formatReminderRuntimeApplyModeLabel(applyMode)}
        </span>
      </div>

      <div className="relative mt-3">
        <select
          id={id}
          value={value}
          onChange={(event) => onValueChange?.(event.target.value)}
          disabled={isReadOnly}
          className="w-full appearance-none rounded-xl border border-[var(--border)] bg-[var(--panel)] px-3 py-2.5 pr-10 text-sm text-[var(--text)] outline-none transition focus:ring-2 focus:ring-teal-500/30 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-700"
        >
          {allowedValues.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown
          size={16}
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted)]"
        />
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-xs">
        <span className="rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-700">
          {isReadOnly ? 'Solo lectura' : 'Editable'}
        </span>
        <span className="rounded-full bg-teal-50 px-2.5 py-1 font-medium text-teal-800">
          {isReadOnly ? 'Campo visible por rol' : 'Cambio permitido'}
        </span>
        {readOnlyNote ? (
          <span className="rounded-full bg-amber-50 px-2.5 py-1 font-medium text-amber-800">
            {readOnlyNote}
          </span>
        ) : null}
      </div>

      {helperText ? (
        <p className="mt-3 text-xs text-[var(--muted)]">{helperText}</p>
      ) : null}

      {warningText ? (
        <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {warningText}
        </p>
      ) : null}
    </div>
  );
}
