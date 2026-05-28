interface MetricCardProps {
  title: string;
  value: number | string;
  tone?: 'neutral' | 'danger' | 'warning' | 'success';
  size?: 'sm' | 'lg';
}

export function MetricCard({
  title,
  value,
  tone = 'neutral',
  size = 'sm',
}: MetricCardProps) {
  const toneClass =
    tone === 'danger'
      ? 'text-rose-700'
      : tone === 'warning'
        ? 'text-amber-700'
        : tone === 'success'
          ? 'text-emerald-700'
          : 'text-slate-800';

  const valueClass = size === 'lg' ? 'text-3xl' : 'text-xl';

  return (
    <article className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-4 shadow-sm">
      <p className="text-xs uppercase tracking-[0.12em] text-[var(--muted)]">{title}</p>
      <p className={`mt-2 font-semibold ${valueClass} ${toneClass}`}>{value}</p>
    </article>
  );
}
