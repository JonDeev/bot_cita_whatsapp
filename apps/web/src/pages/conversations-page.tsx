import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useConversationsQuery } from '../features/conversations/conversations.hooks';
import type { AdminConversationListItem } from '../features/conversations/conversations.types';
import { formatDateTime, localDateTimeToIso } from '../shared/intl/date';
import {
  formatConversationStateLabel,
  formatConversationStatusLabel,
} from '../shared/intl/admin-labels';
import { DataTable, type DataTableColumn } from '../shared/ui/data-table';
import { PaginationControls } from '../shared/ui/pagination-controls';

const PAGE_SIZE = 20;

export function ConversationsPage() {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [phoneFilter, setPhoneFilter] = useState('');
  const [fromFilter, setFromFilter] = useState('');
  const [toFilter, setToFilter] = useState('');

  const queryParams: {
    page: number;
    pageSize: number;
    status?: string;
    phone?: string;
    from?: string;
    to?: string;
  } = {
    page,
    pageSize: PAGE_SIZE,
  };

  if (statusFilter.length > 0) {
    queryParams.status = statusFilter;
  }

  if (phoneFilter.length > 0) {
    queryParams.phone = phoneFilter;
  }

  const fromIso = localDateTimeToIso(fromFilter);
  if (fromIso) {
    queryParams.from = fromIso;
  }

  const toIso = localDateTimeToIso(toFilter);
  if (toIso) {
    queryParams.to = toIso;
  }

  const query = useConversationsQuery(queryParams);

  const columns: DataTableColumn<AdminConversationListItem>[] = [
    {
      id: 'id',
      header: 'ID',
      cell: (item) => `#${item.id}`,
    },
    {
      id: 'phone',
      header: 'Telefono',
      cell: (item) => item.participantPhoneMasked,
    },
    {
      id: 'status',
      header: 'Estado',
      cell: (item) => formatConversationStatusLabel(item.status),
    },
    {
      id: 'state',
      header: 'Etapa',
      cell: (item) => formatConversationStateLabel(item.state),
    },
    {
      id: 'lastMessageBody',
      header: 'Ultimo mensaje',
      cell: (item) => item.lastMessageBody ?? 'Sin contenido',
    },
    {
      id: 'updatedAt',
      header: 'Actualizado',
      cell: (item) => formatDateTime(item.updatedAtIso),
    },
    {
      id: 'detail',
      header: 'Detalle',
      cell: (item) => (
        <Link
          className="font-medium text-[var(--accent)] underline"
          to={`/admin/conversations/${item.id}`}
        >
          Ver
        </Link>
      ),
    },
  ];

  return (
    <section className="space-y-4">
      <header className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-5 shadow-sm">
        <h1 className="text-2xl font-semibold tracking-tight">Conversaciones</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Monitoreo operativo de conversaciones y contexto reciente.
        </p>

        <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          <input
            placeholder="Filtrar por estado"
            value={statusFilter}
            onChange={(event) => {
              setStatusFilter(event.target.value);
              setPage(1);
            }}
            className="rounded-xl border border-[var(--border)] px-3 py-2 text-sm"
          />
          <input
            placeholder="Filtrar por telefono"
            value={phoneFilter}
            onChange={(event) => {
              setPhoneFilter(event.target.value);
              setPage(1);
            }}
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
        </div>
      </header>

      <article className="overflow-x-auto rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-4 shadow-sm">
        <DataTable
          columns={columns}
          items={query.data?.items ?? []}
          getRowKey={(item) => item.id}
          emptyTitle="No hay conversaciones para los filtros aplicados."
          isLoading={query.isLoading}
          isError={query.isError}
          loadingTitle="Cargando conversaciones..."
          errorTitle="No fue posible cargar conversaciones."
          errorDescription="Reintenta en unos segundos."
        />

        {query.data ? (
          <PaginationControls
            page={query.data.page}
            pageSize={query.data.pageSize}
            total={query.data.total}
            onPageChange={setPage}
          />
        ) : null}
      </article>
    </section>
  );
}
