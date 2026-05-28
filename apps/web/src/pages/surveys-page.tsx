import { useMemo, useState } from 'react';
import {
  useSurveyDispatchesQuery,
  useSurveyMetricsQuery,
} from '../features/surveys/surveys.hooks';
import type {
  AdminSurveyDispatchItem,
  SatisfactionSurveyMetricsWindow,
} from '../features/surveys/surveys.types';
import { formatDateTime, localDateTimeToIso } from '../shared/intl/date';
import {
  formatSurveyDispatchStatusLabel,
  formatSurveyTriggerTypeLabel,
} from '../shared/intl/admin-labels';
import { DataTable, type DataTableColumn } from '../shared/ui/data-table';
import { MetricCard } from '../shared/ui/metric-card';
import { PaginationControls } from '../shared/ui/pagination-controls';
import { StateMessage } from '../shared/ui/state-messages';

const PAGE_SIZE = 20;

export function SurveysPage() {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [windowStart, setWindowStart] = useState('');
  const [windowEnd, setWindowEnd] = useState('');
  const [fromFilter, setFromFilter] = useState('');
  const [toFilter, setToFilter] = useState('');

  const metricsParams: {
    date?: string;
    windowStart?: string;
    windowEnd?: string;
  } = {};

  if (dateFilter.length > 0) {
    metricsParams.date = dateFilter;
  }

  const hasWindowPair = windowStart.length > 0 && windowEnd.length > 0;
  if (hasWindowPair) {
    metricsParams.windowStart = windowStart;
    metricsParams.windowEnd = windowEnd;
  }

  const dispatchesParams: {
    page: number;
    pageSize: number;
    status?: string;
    from?: string;
    to?: string;
  } = {
    page,
    pageSize: PAGE_SIZE,
  };

  if (statusFilter.length > 0) {
    dispatchesParams.status = statusFilter;
  }

  const fromIso = localDateTimeToIso(fromFilter);
  if (fromIso) {
    dispatchesParams.from = fromIso;
  }

  const toIso = localDateTimeToIso(toFilter);
  if (toIso) {
    dispatchesParams.to = toIso;
  }

  const metrics = useSurveyMetricsQuery(metricsParams);
  const dispatches = useSurveyDispatchesQuery(dispatchesParams);

  const sendRate = useMemo(() => {
    if (!metrics.data) {
      return '0%';
    }

    return `${(metrics.data.totals.sendRate * 100).toFixed(2)}%`;
  }, [metrics.data]);

  const completionRate = useMemo(() => {
    if (!metrics.data) {
      return '0%';
    }

    return `${(metrics.data.totals.completionRate * 100).toFixed(2)}%`;
  }, [metrics.data]);

  const windowColumns = useMemo<DataTableColumn<SatisfactionSurveyMetricsWindow>[]>(() => [
    {
      id: 'window',
      header: 'Ventana',
      cell: (window) => `${window.windowStartHHmm} - ${window.windowEndHHmm}`,
    },
    {
      id: 'eligible',
      header: 'Elegibles',
      cell: (window) => window.eligible,
    },
    {
      id: 'sent',
      header: 'Enviadas',
      cell: (window) => window.sent,
    },
    {
      id: 'completed',
      header: 'Completadas',
      cell: (window) => window.completed,
    },
    {
      id: 'sendRate',
      header: 'Tasa de envio',
      cell: (window) => `${(window.sendRate * 100).toFixed(2)}%`,
    },
    {
      id: 'completionRate',
      header: 'Tasa de completitud',
      cell: (window) => `${(window.completionRate * 100).toFixed(2)}%`,
    },
  ], []);

  const dispatchColumns = useMemo<DataTableColumn<AdminSurveyDispatchItem>[]>(() => [
    {
      id: 'id',
      header: 'ID',
      cell: (item) => `#${item.id}`,
    },
    {
      id: 'phone',
      header: 'Telefono',
      cell: (item) => item.patientPhoneMasked,
    },
    {
      id: 'status',
      header: 'Estado',
      cell: (item) => formatSurveyDispatchStatusLabel(item.status),
    },
    {
      id: 'triggerType',
      header: 'Disparador',
      cell: (item) => formatSurveyTriggerTypeLabel(item.triggerType),
    },
    {
      id: 'updatedAt',
      header: 'Actualizado',
      cell: (item) => formatDateTime(item.updatedAtIso),
    },
  ], []);

  return (
    <section className="space-y-4">
      <header className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-5 shadow-sm">
        <h1 className="text-2xl font-semibold tracking-tight">Encuestas</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Monitoreo de envios y completitud de encuestas de satisfaccion.
        </p>

        <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-6">
          <input
            type="date"
            value={dateFilter}
            onChange={(event) => setDateFilter(event.target.value)}
            className="rounded-xl border border-[var(--border)] px-3 py-2 text-sm"
          />
          <input
            type="time"
            value={windowStart}
            onChange={(event) => setWindowStart(event.target.value)}
            className="rounded-xl border border-[var(--border)] px-3 py-2 text-sm"
          />
          <input
            type="time"
            value={windowEnd}
            onChange={(event) => setWindowEnd(event.target.value)}
            className="rounded-xl border border-[var(--border)] px-3 py-2 text-sm"
          />
          <input
            type="datetime-local"
            value={fromFilter}
            onChange={(event) => {
              setFromFilter(event.target.value);
              setPage(1);
            }}
            className="rounded-xl border border-[var(--border)] px-3 py-2 text-sm"
            placeholder="Desde despacho"
          />
          <input
            type="datetime-local"
            value={toFilter}
            onChange={(event) => {
              setToFilter(event.target.value);
              setPage(1);
            }}
            className="rounded-xl border border-[var(--border)] px-3 py-2 text-sm"
            placeholder="Hasta despacho"
          />
          <input
            value={statusFilter}
            onChange={(event) => {
              setStatusFilter(event.target.value);
              setPage(1);
            }}
            placeholder="Filtrar estado de despacho"
            className="rounded-xl border border-[var(--border)] px-3 py-2 text-sm"
          />
        </div>
      </header>

      {metrics.data ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard title="Elegibles" value={metrics.data.totals.eligible} />
          <MetricCard title="Enviadas" value={metrics.data.totals.sent} />
          <MetricCard title="Completadas" value={metrics.data.totals.completed} tone="success" />
          <MetricCard title="Fallidas" value={metrics.data.totals.failed} tone="danger" />
          <MetricCard title="Declinadas" value={metrics.data.totals.declined} />
          <MetricCard title="Bloqueadas" value={metrics.data.totals.blocked} />
          <MetricCard title="Tasa de envio" value={sendRate} />
          <MetricCard title="Tasa de completitud" value={completionRate} />
        </div>
      ) : null}
      {metrics.isLoading ? (
        <StateMessage title="Cargando metricas de encuestas..." />
      ) : null}
      {metrics.isError ? (
        <StateMessage
          title="No fue posible cargar metricas."
          description="Revisa fecha/ventana y vuelve a intentar."
          tone="danger"
        />
      ) : null}

      <article className="overflow-x-auto rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-4 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
          Ventanas de metricas
        </h2>
        <div className="mt-3">
          <DataTable
            columns={windowColumns}
            items={metrics.data?.windows ?? []}
            getRowKey={(item) => `${item.windowStartHHmm}-${item.windowEndHHmm}`}
            emptyTitle="No hay ventanas disponibles para los filtros aplicados."
            isLoading={metrics.isLoading}
            isError={metrics.isError}
            loadingTitle="Cargando metricas de ventanas..."
            errorTitle="No fue posible cargar metricas de ventanas."
            errorDescription="Revisa filtros y reintenta."
          />
        </div>
      </article>

      <article className="overflow-x-auto rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-4 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
          Despachos
        </h2>
        <div className="mt-3">
          <DataTable
            columns={dispatchColumns}
            items={dispatches.data?.items ?? []}
            getRowKey={(item) => item.id}
            emptyTitle="No hay despachos para los filtros seleccionados."
            isLoading={dispatches.isLoading}
            isError={dispatches.isError}
            loadingTitle="Cargando despachos..."
            errorTitle="No fue posible cargar despachos."
            errorDescription="Reintenta en unos segundos."
          />
        </div>

        {dispatches.data ? (
          <PaginationControls
            page={dispatches.data.page}
            pageSize={dispatches.data.pageSize}
            total={dispatches.data.total}
            onPageChange={setPage}
          />
        ) : null}
      </article>
    </section>
  );
}
