import type { ReactNode } from 'react';

interface StateMessageProps {
  title: string;
  description?: string;
  tone?: 'neutral' | 'danger';
  actions?: ReactNode;
}

export function StateMessage({
  title,
  description,
  tone = 'neutral',
  actions,
}: StateMessageProps) {
  const toneClass = tone === 'danger' ? 'text-rose-700' : 'text-[var(--muted)]';

  return (
    <div className="rounded-xl border border-dashed border-[var(--border)] bg-slate-50 px-4 py-3">
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
