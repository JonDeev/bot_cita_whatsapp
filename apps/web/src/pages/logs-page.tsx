import { useMemo, useState } from 'react';
import {
  useAuditLogsQuery,
  useFailureLogsQuery,
  useOperationalEventsQuery,
} from '../features/logs/logs.hooks';
import type {
  AdminAuditLogItem,
  AdminFailureLogItem,
  AdminOperationalEventItem,
} from '../features/logs/logs.types';
import { useAdminAccess } from '../features/auth/use-admin-access';
import {
  formatFailureSourceLabel,
  formatSystemCodeLabel,
} from '../shared/intl/admin-labels';
import { formatDateTime, localDateTimeToIso } from '../shared/intl/date';
import { DataTable, type DataTableColumn } from '../shared/ui/data-table';
import { PaginationControls } from '../shared/ui/pagination-controls';
import { StateMessage } from '../shared/ui/state-messages';
import { safeJson } from '../shared/utils/safe-json';

type LogsTab = 'events' | 'failures' | 'audit';
const PAGE_SIZE = 20;
const logsTabLabel: Record<LogsTab, string> = {
  events: 'eventos',
  failures: 'fallos',
  audit: 'auditoria',
};

export function LogsPage() {
  const [tab, setTab] = useState<LogsTab>('events');
  const [page, setPage] = useState(1);
  const [actionFilter, setActionFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState<'OUTBOX' | 'WEBHOOK' | ''>('');
  const [adminUserIdFilter, setAdminUserIdFilter] = useState('');
  const [fromFilter, setFromFilter] = useState('');
  const [toFilter, setToFilter] = useState('');
  const access = useAdminAccess();

  const fromIso = localDateTimeToIso(fromFilter);
  const toIso = localDateTimeToIso(toFilter);

  const eventsParams: {
    page: number;
    pageSize: number;
    action?: string;
    from?: string;
    to?: string;
  } = {
    page,
    pageSize: PAGE_SIZE,
  };
  if (actionFilter.length > 0) {
    eventsParams.action = actionFilter;
  }
  if (fromIso) {
    eventsParams.from = fromIso;
  }
  if (toIso) {
    eventsParams.to = toIso;
  }

  const failuresParams: {
    page: number;
    pageSize: number;
    source?: 'OUTBOX' | 'WEBHOOK';
    from?: string;
    to?: string;
  } = {
    page,
    pageSize: PAGE_SIZE,
  };
  if (sourceFilter) {
    failuresParams.source = sourceFilter;
  }
  if (fromIso) {
    failuresParams.from = fromIso;
  }
  if (toIso) {
    failuresParams.to = toIso;
  }

  const auditParams: {
    page: number;
    pageSize: number;
    action?: string;
    adminUserId?: number;
    from?: string;
    to?: string;
  } = {
    page,
    pageSize: PAGE_SIZE,
  };
  if (actionFilter.length > 0) {
    auditParams.action = actionFilter;
  }

  const adminUserIdParsed = Number(adminUserIdFilter);
  if (Number.isInteger(adminUserIdParsed) && adminUserIdParsed > 0) {
    auditParams.adminUserId = adminUserIdParsed;
  }
  if (fromIso) {
    auditParams.from = fromIso;
  }
  if (toIso) {
    auditParams.to = toIso;
  }

  const events = useOperationalEventsQuery(
    eventsParams,
    { enabled: tab === 'events' },
  );
  const failures = useFailureLogsQuery(
    failuresParams,
    { enabled: tab === 'failures' },
  );
  const audit = useAuditLogsQuery(
    auditParams,
    { enabled: tab === 'audit' },
  );

  const activeData = useMemo(() => {
    if (tab === 'events') {
      return events.data;
    }

    if (tab === 'failures') {
      return failures.data;
    }

    return audit.data;
  }, [audit.data, events.data, failures.data, tab]);

  const eventColumns = useMemo<DataTableColumn<AdminOperationalEventItem>[]>(() => {
    const columns: DataTableColumn<AdminOperationalEventItem>[] = [
      {
        id: 'occurredAt',
        header: 'Fecha',
        cell: (item) => formatDateTime(item.occurredAtIso),
      },
      {
        id: 'action',
        header: 'Accion',
        cell: (item) => item.action,
      },
      {
        id: 'conversation',
        header: 'Conversacion',
        cell: (item) => item.conversationId ?? '-',
      },
    ];

    if (access.canViewTechnicalDetails) {
      columns.push({
        id: 'metadata',
        header: 'Metadatos',
        cell: (item) => safeJson(item.metadata),
      });
    }

    return columns;
  }, [access.canViewTechnicalDetails]);

  const failureColumns = useMemo<DataTableColumn<AdminFailureLogItem>[]>(() => {
    const columns: DataTableColumn<AdminFailureLogItem>[] = [
      {
        id: 'occurredAt',
        header: 'Fecha',
        cell: (item) => formatDateTime(item.occurredAtIso),
      },
      {
        id: 'source',
        header: 'Origen',
        cell: (item) => formatFailureSourceLabel(item.source),
      },
      {
        id: 'status',
        header: 'Estado',
        cell: (item) => formatSystemCodeLabel(item.status),
      },
    ];

    if (access.canViewTechnicalDetails) {
      columns.push({
        id: 'error',
        header: 'Error',
        cell: (item) => item.errorMessage ?? item.errorCode ?? '-',
      });
    }

    columns.push({
      id: 'conversation',
      header: 'Conversacion',
      cell: (item) => item.conversationId ?? '-',
    });

    return columns;
  }, [access.canViewTechnicalDetails]);

  const auditColumns = useMemo<DataTableColumn<AdminAuditLogItem>[]>(() => {
    const columns: DataTableColumn<AdminAuditLogItem>[] = [
      {
        id: 'occurredAt',
        header: 'Fecha',
        cell: (item) => formatDateTime(item.occurredAtIso),
      },
      {
        id: 'adminUsername',
        header: 'Usuario',
        cell: (item) => item.adminUsername ?? '-',
      },
      {
        id: 'action',
        header: 'Accion',
        cell: (item) => item.action,
      },
      {
        id: 'resource',
        header: 'Recurso',
        cell: (item) => `${item.resourceType ?? '-'} ${item.resourceId ?? ''}`.trim(),
      },
    ];

    if (access.canViewTechnicalDetails) {
      columns.push({
        id: 'metadata',
        header: 'Metadatos',
        cell: (item) => safeJson(item.metadata),
      });
    }

    return columns;
  }, [access.canViewTechnicalDetails]);

  return (
    <section className="space-y-4">
      <header className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-5 shadow-sm">
        <h1 className="text-2xl font-semibold tracking-tight">Registros operativos</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Eventos, fallos tecnicos y auditoria administrativa.
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          {(['events', 'failures', 'audit'] as LogsTab[]).map((item) => (
            <button
              type="button"
              key={item}
              onClick={() => {
                setTab(item);
                setPage(1);
                setActionFilter('');
                setSourceFilter('');
                setAdminUserIdFilter('');
                setFromFilter('');
                setToFilter('');
              }}
              className={`rounded-xl px-3 py-2 text-sm ${
                tab === item
                  ? 'bg-slate-900 text-white'
                  : 'border border-[var(--border)] bg-white text-slate-700'
              }`}
            >
              {logsTabLabel[item]}
            </button>
          ))}
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          <input
            type="datetime-local"
            value={fromFilter}
            onChange={(event) => {
              setFromFilter(event.target.value);
              setPage(1);
            }}
            className="rounded-xl border border-[var(--border)] px-3 py-2 text-sm"
          />
          <input
            type="datetime-local"
            value={toFilter}
            onChange={(event) => {
              setToFilter(event.target.value);
              setPage(1);
            }}
            className="rounded-xl border border-[var(--border)] px-3 py-2 text-sm"
          />
          {tab === 'events' || tab === 'audit' ? (
            <input
              placeholder="Filtrar accion"
              value={actionFilter}
              onChange={(event) => {
                setActionFilter(event.target.value);
                setPage(1);
              }}
              className="rounded-xl border border-[var(--border)] px-3 py-2 text-sm"
            />
          ) : null}
          {tab === 'failures' ? (
            <select
              value={sourceFilter}
              onChange={(event) => {
                const next = event.target.value;
                setSourceFilter(next === 'OUTBOX' || next === 'WEBHOOK' ? next : '');
                setPage(1);
              }}
              className="rounded-xl border border-[var(--border)] px-3 py-2 text-sm"
            >
              <option value="">Todos los origenes</option>
              <option value="OUTBOX">Bandeja de salida</option>
              <option value="WEBHOOK">Webhook</option>
            </select>
          ) : null}
          {tab === 'audit' ? (
            <input
              type="number"
              min={1}
              placeholder="Filtrar id de admin"
              value={adminUserIdFilter}
              onChange={(event) => {
                setAdminUserIdFilter(event.target.value);
                setPage(1);
              }}
              className="rounded-xl border border-[var(--border)] px-3 py-2 text-sm"
            />
          ) : null}
        </div>
      </header>

      <article className="overflow-x-auto rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-4 shadow-sm">
        {tab === 'events' ? (
          <DataTable
            columns={eventColumns}
            items={events.data?.items ?? []}
            getRowKey={(item) => item.id}
            emptyTitle="No hay eventos para los filtros aplicados."
            isLoading={events.isLoading}
            isError={events.isError}
            loadingTitle="Cargando registros..."
            errorTitle="No fue posible cargar registros."
            errorDescription="Reintenta en unos segundos."
          />
        ) : null}

        {tab === 'failures' ? (
          <DataTable
            columns={failureColumns}
            items={failures.data?.items ?? []}
            getRowKey={(item) => `${item.source}-${item.id}`}
            emptyTitle="No hay fallos para los filtros aplicados."
            isLoading={failures.isLoading}
            isError={failures.isError}
            loadingTitle="Cargando registros..."
            errorTitle="No fue posible cargar registros."
            errorDescription="Reintenta en unos segundos."
          />
        ) : null}

        {tab === 'audit' ? (
          <DataTable
            columns={auditColumns}
            items={audit.data?.items ?? []}
            getRowKey={(item) => item.id}
            emptyTitle="No hay eventos de auditoria para los filtros aplicados."
            isLoading={audit.isLoading}
            isError={audit.isError}
            loadingTitle="Cargando registros..."
            errorTitle="No fue posible cargar registros."
            errorDescription="Reintenta en unos segundos."
          />
        ) : null}
        {!access.canViewTechnicalDetails ? (
          <div className="mt-3">
            <StateMessage
              title="Detalle tecnico oculto por rol SUPERVISOR."
              description="Los campos internos de error y metadatos solo son visibles para ADMIN."
            />
          </div>
        ) : null}

        {activeData ? (
          <PaginationControls
            page={activeData.page}
            pageSize={activeData.pageSize}
            total={activeData.total}
            onPageChange={setPage}
          />
        ) : null}
      </article>
    </section>
  );
}
