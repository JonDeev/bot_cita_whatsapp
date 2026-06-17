import type { ReactNode } from 'react';

interface SurveySettingsSectionProps {
  title: string;
  description: string;
  summary: string;
  tone?: 'neutral' | 'warning';
  collapsible?: boolean;
  defaultOpen?: boolean;
  children: ReactNode;
}

export function SurveySettingsSection({
  title,
  description,
  summary,
  tone = 'neutral',
  collapsible = false,
  defaultOpen = true,
  children,
}: SurveySettingsSectionProps) {
  const wrapperClassName =
    tone === 'warning'
      ? 'border-amber-200 bg-amber-50/30'
      : 'border-[var(--border)] bg-[var(--panel)]';

  if (collapsible) {
    return (
      <details
        className={`rounded-2xl border shadow-sm ${wrapperClassName}`}
        open={defaultOpen}
      >
        <summary className="cursor-pointer list-none px-4 py-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.14em] text-[var(--muted)]">
                {summary}
              </p>
              <h2 className="mt-1 text-lg font-semibold tracking-tight">{title}</h2>
              <p className="mt-1 text-sm text-[var(--muted)]">{description}</p>
            </div>
            <span className="rounded-full bg-white/70 px-3 py-1 text-xs font-medium text-[var(--muted)]">
              Expandir
            </span>
          </div>
        </summary>
        <div className="border-t border-[var(--border)] px-4 py-4">{children}</div>
      </details>
    );
  }

  return (
    <article className={`rounded-2xl border p-4 shadow-sm ${wrapperClassName}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.14em] text-[var(--muted)]">
            {summary}
          </p>
          <h2 className="mt-1 text-lg font-semibold tracking-tight">{title}</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">{description}</p>
        </div>
      </div>
      <div className="mt-4">{children}</div>
    </article>
  );
}
