import { useMemo, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAdminAccess } from '../features/auth/use-admin-access';
import {
  useReminderDispatchesQuery,
  useReminderMetricsQuery,
} from '../features/reminders/reminders.hooks';
import type { AdminReminderDispatchItem } from '../features/reminders/reminders.types';
import { formatDateTime, localDateTimeToIso } from '../shared/intl/date';
import {
  formatReminderDispatchStatusLabel,
  formatReminderTypeLabel,
} from '../shared/intl/admin-labels';
import { DataTable, type DataTableColumn } from '../shared/ui/data-table';
import { MetricCard } from '../shared/ui/metric-card';
import { PaginationControls } from '../shared/ui/pagination-controls';
import { StateMessage } from '../shared/ui/state-messages';

const PAGE_SIZE = 20;

const remindersAreaNavItems = [
  { to: '/admin/reminders', label: 'Operacion', end: true },
  { to: '/admin/reminders/settings', label: 'Configuracion', end: false },
  { to: '/admin/reminders/settings/guide', label: 'Guia de uso', end: false },
] as const;

export function RemindersPage() {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [lookbackHoursInput, setLookbackHoursInput] = useState('24');
  const [fromFilter, setFromFilter] = useState('');
  const [toFilter, setToFilter] = useState('');
  const access = useAdminAccess();

  const lookbackHours = useMemo(() => {
    const parsed = Number(lookbackHoursInput);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 168) {
      return undefined;
    }

    return parsed;
  }, [lookbackHoursInput]);

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

  const metrics = useReminderMetricsQuery(lookbackHours);
  const dispatches = useReminderDispatchesQuery(dispatchesParams);

  const dispatchColumns = useMemo<DataTableColumn<AdminReminderDispatchItem>[]>(() => {
    const columns: DataTableColumn<AdminReminderDispatchItem>[] = [
      {
        id: 'id',
        header: 'ID',
        cell: (item) => `#${item.id}`,
      },
      {
        id: 'phone',
        header: 'Telefono',
        cell: (item) => item.recipientPhoneMasked,
      },
      {
        id: 'reminderType',
        header: 'Tipo',
        cell: (item) => formatReminderTypeLabel(item.reminderType),
      },
      {
        id: 'status',
        header: 'Estado',
        cell: (item) => formatReminderDispatchStatusLabel(item.status),
      },
      {
        id: 'attempts',
        header: 'Intentos',
        cell: (item) => item.attempts,
      },
      {
        id: 'scheduledFor',
        header: 'Programado',
        cell: (item) => formatDateTime(item.scheduledForIso),
      },
    ];

    if (access.canViewTechnicalDetails) {
      columns.push({
        id: 'lastError',
        header: 'Error',
        cell: (item) => item.lastError ?? '-',
      });
    }

    return columns;
  }, [access.canViewTechnicalDetails]);

  return (
    <section className="space-y-4">
      <header className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-5 shadow-sm">
        <h1 className="text-2xl font-semibold tracking-tight">Recordatorios</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Salud operativa de despachos de recordatorios.
        </p>

        <nav className="mt-4 flex flex-wrap gap-2" aria-label="Navegacion de recordatorios">
          {remindersAreaNavItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `rounded-full border px-3 py-2 text-sm font-medium transition ${
                  isActive
                    ? 'border-teal-200 bg-teal-50 text-teal-900'
                    : 'border-[var(--border)] bg-white text-[var(--muted)] hover:bg-slate-50'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          <input
            type="number"
            min={1}
            max={168}
            value={lookbackHoursInput}
            onChange={(event) => setLookbackHoursInput(event.target.value)}
            className="rounded-xl border border-[var(--border)] px-3 py-2 text-sm"
            placeholder="Horas de ventana"
          />
          <input
            type="datetime-local"
            value={fromFilter}
            onChange={(event) => {
              setFromFilter(event.target.value);
              setPage(1);
            }}
            className="rounded-xl border border-[var(--border)] px-3 py-2 text-sm"
            placeholder="Desde"
          />
          <input
            type="datetime-local"
            value={toFilter}
            onChange={(event) => {
              setToFilter(event.target.value);
              setPage(1);
            }}
            className="rounded-xl border border-[var(--border)] px-3 py-2 text-sm"
            placeholder="Hasta"
          />
          <input
            value={statusFilter}
            onChange={(event) => {
              setStatusFilter(event.target.value);
              setPage(1);
            }}
            className="rounded-xl border border-[var(--border)] px-3 py-2 text-sm"
            placeholder="Filtrar estado de despacho"
          />
        </div>
      </header>

      {metrics.data ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard title="Pendientes" value={metrics.data.states.pending} />
          <MetricCard title="Enviados" value={metrics.data.states.sent} />
          <MetricCard title="Fallidos" value={metrics.data.states.failed} tone="danger" />
          <MetricCard title="Atraso pendiente" value={metrics.data.backlog.dueDispatches} />
          <MetricCard title="Latencia promedio(s)" value={metrics.data.recent.sendLatencySecondsAvg} />
          <MetricCard
            title="Latencia p95(s)"
            value={metrics.data.recent.sendLatencySecondsP95Approx}
          />
          <MetricCard
            title="Locks recuperados"
            value={metrics.data.reliability.lockRecoveredEvents}
          />
          <MetricCard title="Locks perdidos" value={metrics.data.reliability.lockLostEvents} />
        </div>
      ) : null}
      {metrics.isLoading ? (
        <StateMessage title="Cargando metricas de recordatorios..." />
      ) : null}
      {metrics.isError ? (
        <StateMessage
          title="No fue posible cargar metricas."
          description="Valida filtros e intenta nuevamente."
          tone="danger"
        />
      ) : null}

      <article className="overflow-x-auto rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-4 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
          Despachos
        </h2>
        <div className="mt-3">
          <DataTable
            columns={dispatchColumns}
            items={dispatches.data?.items ?? []}
            getRowKey={(item) => item.id}
            emptyTitle="No hay despachos para los filtros aplicados."
            isLoading={dispatches.isLoading}
            isError={dispatches.isError}
            loadingTitle="Cargando despachos..."
            errorTitle="No fue posible cargar despachos."
            errorDescription="Reintenta en unos segundos."
          />
        </div>
        {!access.canViewTechnicalDetails ? (
          <div className="mt-3">
            <StateMessage
              title="Detalle tecnico de errores oculto por rol SUPERVISOR."
              description="Solo ADMIN puede ver errores completos de despacho."
            />
          </div>
        ) : null}

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
