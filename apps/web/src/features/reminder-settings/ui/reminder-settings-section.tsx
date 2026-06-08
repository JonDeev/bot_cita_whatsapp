import { ChevronDown } from 'lucide-react';
import type { PropsWithChildren } from 'react';

interface ReminderSettingsSectionProps extends PropsWithChildren {
  title: string;
  description: string;
  summary?: string;
  tone?: 'neutral' | 'warning';
  collapsible?: boolean;
  defaultOpen?: boolean;
}

export function ReminderSettingsSection({
  title,
  description,
  summary,
  tone = 'neutral',
  collapsible = false,
  defaultOpen = false,
  children,
}: ReminderSettingsSectionProps) {
  const shellClass =
    tone === 'warning'
      ? 'border-amber-200 bg-amber-50/40'
      : 'border-[var(--border)] bg-[var(--panel)]';

  if (collapsible) {
    return (
      <details
        open={defaultOpen}
        className={`group rounded-2xl border shadow-sm ${shellClass}`}
      >
        <summary className="flex cursor-pointer list-none items-start justify-between gap-3 px-4 py-4">
          <div>
            <h3 className="text-base font-semibold text-[var(--text)]">{title}</h3>
            <p className="mt-1 text-sm text-[var(--muted)]">{description}</p>
            {summary ? (
              <p className="mt-2 text-xs text-[var(--muted)]">{summary}</p>
            ) : null}
          </div>
          <ChevronDown className="mt-1 shrink-0 text-[var(--muted)] transition group-open:rotate-180" size={16} />
        </summary>
        <div className="border-t border-[var(--border)] px-4 py-4">{children}</div>
      </details>
    );
  }

  return (
    <article className={`rounded-2xl border shadow-sm ${shellClass}`}>
      <header className="border-b border-[var(--border)] px-4 py-4">
        <h3 className="text-base font-semibold text-[var(--text)]">{title}</h3>
        <p className="mt-1 text-sm text-[var(--muted)]">{description}</p>
        {summary ? <p className="mt-2 text-xs text-[var(--muted)]">{summary}</p> : null}
      </header>
      <div className="space-y-3 px-4 py-4">{children}</div>
    </article>
  );
}

