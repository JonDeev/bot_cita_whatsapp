import type { ReactNode } from 'react';

interface PagePlaceholderProps {
  title: string;
  description: string;
  actions?: ReactNode;
}

export function PagePlaceholder({
  title,
  description,
  actions,
}: PagePlaceholderProps) {
  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-6 shadow-sm">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-2 max-w-2xl text-sm text-[var(--muted)]">{description}</p>
      {actions ? <div className="mt-4">{actions}</div> : null}
    </section>
  );
}
