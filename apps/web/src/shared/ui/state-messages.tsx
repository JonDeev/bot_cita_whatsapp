import type { ReactNode } from 'react';

interface StateMessageProps {
  title: string;
  description?: string | undefined;
  tone?: 'neutral' | 'danger' | 'success' | 'warning';
  actions?: ReactNode;
}

export function StateMessage({
  title,
  description,
  tone = 'neutral',
  actions,
}: StateMessageProps) {
  const toneClass =
    tone === 'danger'
      ? 'text-rose-700'
      : tone === 'warning'
        ? 'text-amber-700'
      : tone === 'success'
        ? 'text-emerald-700'
        : 'text-[var(--muted)]';

  return (
    <div
      className={`rounded-xl border border-dashed px-4 py-3 ${
        tone === 'danger'
          ? 'border-rose-200 bg-rose-50'
          : tone === 'warning'
            ? 'border-amber-200 bg-amber-50'
          : tone === 'success'
            ? 'border-emerald-200 bg-emerald-50'
            : 'border-[var(--border)] bg-slate-50'
      }`}
    >
      <p className={`text-sm font-semibold ${toneClass}`}>{title}</p>
      {description ? <p className="mt-1 text-sm text-[var(--muted)]">{description}</p> : null}
      {actions ? <div className="mt-3">{actions}</div> : null}
    </div>
  );
}

interface TableEmptyRowProps {
  colSpan: number;
  title: string;
  description?: string;
}

export function TableEmptyRow({
  colSpan,
  title,
  description,
}: TableEmptyRowProps) {
  const messageProps: { title: string; description?: string } = { title };
  if (description) {
    messageProps.description = description;
  }

  return (
    <tr>
      <td className="px-2 py-6" colSpan={colSpan}>
        <StateMessage {...messageProps} />
      </td>
    </tr>
  );
}
