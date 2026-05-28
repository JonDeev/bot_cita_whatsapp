import { RefreshCw } from 'lucide-react';
import { useMemo } from 'react';
import { useLiveFeedQuery, useOverviewQuery } from '../features/overview/overview.hooks';
import {
  formatLiveEventTypeLabel,
  formatLiveSummaryLabel,
  formatReminderDispatchStatusLabel,
  formatSurveyDispatchStatusLabel,
} from '../shared/intl/admin-labels';
import { formatDateTime } from '../shared/intl/date';
import { MetricCard } from '../shared/ui/metric-card';
import { StateMessage } from '../shared/ui/state-messages';

function DispatchGroup({
  title,
  items,
  formatStatus,
}: {
  title: string;
  items: { status: string; count: number }[];
  formatStatus: (status: string) => string;
}) {
  return (
    <article className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-4 shadow-sm">
      <h2 className="text-sm font-semibold">{title}</h2>
      <div className="mt-3 flex flex-wrap gap-2">
        {items.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">Sin datos.</p>
        ) : (
          items.map((item) => (
            <span
              className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700"
              key={`${title}-${item.status}`}
            >
              {formatStatus(item.status)}: {item.count}
            </span>
          ))
        )}
      </div>
    </article>
  );
}

export function DashboardPage() {
  const overview = useOverviewQuery();
  const liveFeed = useLiveFeedQuery();

  const generatedAt = useMemo(() => {
    if (!overview.data?.generatedAtIso) {
      return 'Cargando';
    }

    return formatDateTime(overview.data.generatedAtIso);
  }, [overview.data?.generatedAtIso]);

  return (
    <section className="space-y-5">
      <header className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Panel operativo</h1>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Ventana de observabilidad: ultimas {overview.data?.lookbackHours ?? '-'} horas.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              void overview.refetch();
              void liveFeed.refetch();
            }}
            className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] px-3 py-2 text-sm hover:bg-slate-100"
          >
            <RefreshCw size={14} />
            Refrescar
          </button>
        </div>
        <p className="mt-3 text-xs text-[var(--muted)]">Actualizado: {generatedAt}</p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <MetricCard
          size="lg"
          title="Mensajes entrantes"
          value={overview.data?.inboundMessages ?? 0}
        />
        <MetricCard
          size="lg"
          title="Mensajes salientes"
          value={overview.data?.outboundMessages ?? 0}
        />
        <MetricCard
          size="lg"
          title="Conversaciones activas"
          value={overview.data?.activeConversations ?? 0}
          tone="success"
        />
        <MetricCard
          size="lg"
          title="Fallos en bandeja de salida"
          value={overview.data?.outboxFailed ?? 0}
          tone="danger"
        />
        <MetricCard
          size="lg"
          title="Webhooks fallidos"
          value={overview.data?.webhookFailed ?? 0}
          tone="warning"
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <DispatchGroup
          title="Recordatorios por estado"
          items={overview.data?.reminderDispatches ?? []}
          formatStatus={formatReminderDispatchStatusLabel}
        />
        <DispatchGroup
          title="Encuestas por estado"
          items={overview.data?.surveyDispatches ?? []}
          formatStatus={formatSurveyDispatchStatusLabel}
        />
      </div>

      <article className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-5 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
          Eventos en vivo
        </h2>
        {overview.isLoading || liveFeed.isLoading ? (
          <div className="mt-4">
            <StateMessage title="Cargando panel..." />
          </div>
        ) : null}
        {overview.isError || liveFeed.isError ? (
          <div className="mt-4">
            <StateMessage
              title="No fue posible cargar el panel."
              description="Reintenta o valida conectividad/sesion."
              tone="danger"
            />
          </div>
        ) : null}
        <ul className="mt-4 space-y-3">
          {(liveFeed.data?.items ?? []).map((item) => (
            <li key={item.eventId} className="rounded-xl border border-slate-200 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium">{formatLiveSummaryLabel(item.summary)}</p>
                <span className="text-xs text-[var(--muted)]">
                  {formatDateTime(item.occurredAtIso)}
                </span>
              </div>
              <p className="mt-1 text-xs text-[var(--muted)]">
                {formatLiveEventTypeLabel(item.eventType)}
                {item.conversationId ? ` · conversacion #${item.conversationId}` : ''}
              </p>
            </li>
          ))}
          {liveFeed.data && liveFeed.data.items.length === 0 ? (
            <li className="text-sm text-[var(--muted)]">No hay eventos recientes.</li>
          ) : null}
        </ul>
      </article>
    </section>
  );
}
