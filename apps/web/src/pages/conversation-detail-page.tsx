import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAdminAccess } from '../features/auth/use-admin-access';
import {
  useConversationDetailQuery,
  useConversationMessagesQuery,
} from '../features/conversations/conversations.hooks';
import type { AdminConversationMessageItem } from '../features/conversations/conversations.types';
import { formatDateTime } from '../shared/intl/date';
import {
  formatConversationStateLabel,
  formatConversationStatusLabel,
  formatMessageDirectionLabel,
  formatMessageTypeLabel,
  formatSystemCodeLabel,
} from '../shared/intl/admin-labels';
import { DataTable, type DataTableColumn } from '../shared/ui/data-table';
import { PaginationControls } from '../shared/ui/pagination-controls';
import { StateMessage } from '../shared/ui/state-messages';
import { safeJson } from '../shared/utils/safe-json';

const PAGE_SIZE = 20;

export function ConversationDetailPage() {
  const params = useParams<{ conversationId: string }>();
  const conversationId = Number(params.conversationId);
  const [page, setPage] = useState(1);
  const access = useAdminAccess();

  const detail = useConversationDetailQuery(conversationId);
  const messages = useConversationMessagesQuery(conversationId, {
    page,
    pageSize: PAGE_SIZE,
  });

  const messageColumns: DataTableColumn<AdminConversationMessageItem>[] = [
    {
      id: 'occurredAt',
      header: 'Fecha',
      cell: (item) => formatDateTime(item.occurredAtIso),
    },
    {
      id: 'direction',
      header: 'Direccion',
      cell: (item) => formatMessageDirectionLabel(item.direction),
    },
    {
      id: 'messageType',
      header: 'Tipo',
      cell: (item) => formatMessageTypeLabel(item.messageType),
    },
    {
      id: 'body',
      header: 'Contenido',
      cell: (item) => item.body ?? 'Sin contenido',
    },
  ];

  if (access.canViewTechnicalDetails) {
    messageColumns.push({
      id: 'payload',
      header: 'Carga tecnica',
      cell: (item) => safeJson(item.payload),
    });
  }

  if (!Number.isFinite(conversationId) || conversationId <= 0) {
    return (
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-5">
        <p className="text-sm text-[var(--muted)]">Conversacion invalida.</p>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <header className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-5 shadow-sm">
        <Link className="text-sm font-medium text-[var(--accent)] underline" to="/admin/conversations">
          Volver al listado
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          Conversacion #{conversationId}
        </h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          {detail.data
            ? `${formatConversationStatusLabel(detail.data.status)} · ${formatConversationStateLabel(detail.data.state)} · ${detail.data.participantPhoneMasked}`
            : 'Cargando detalle...'}
        </p>
      </header>

      {detail.data ? (
        <article className="grid gap-3 rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-4 shadow-sm md:grid-cols-2">
          <p className="text-sm">
            <span className="font-semibold">Canal:</span>{' '}
            {formatSystemCodeLabel(detail.data.channel)}
          </p>
          <p className="text-sm">
            <span className="font-semibold">Clave de conversacion:</span>{' '}
            {detail.data.conversationKey}
          </p>
          <p className="text-sm">
            <span className="font-semibold">Creada:</span>{' '}
            {formatDateTime(detail.data.createdAtIso)}
          </p>
          <p className="text-sm">
            <span className="font-semibold">Actualizada:</span>{' '}
            {formatDateTime(detail.data.updatedAtIso)}
          </p>
        </article>
      ) : null}
      {detail.isLoading ? (
        <StateMessage title="Cargando detalle de conversacion..." />
      ) : null}
      {detail.isError ? (
        <StateMessage
          title="No fue posible cargar el detalle de la conversacion."
          description="Reintenta en unos segundos."
          tone="danger"
        />
      ) : null}

      <article className="overflow-x-auto rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-4 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
          Mensajes
        </h2>
        <div className="mt-3">
          <DataTable
            columns={messageColumns}
            items={messages.data?.items ?? []}
            getRowKey={(item) => item.id}
            emptyTitle="No hay mensajes en esta conversacion."
            isLoading={messages.isLoading}
            isError={messages.isError}
            loadingTitle="Cargando mensajes..."
            errorTitle="No fue posible cargar mensajes."
            errorDescription="Reintenta en unos segundos."
          />
        </div>
        {!access.canViewTechnicalDetails ? (
          <div className="mt-3">
            <StateMessage
              title="Carga tecnica oculta por rol SUPERVISOR."
              description="Para inspeccion tecnica completa ingresa con un usuario ADMIN."
            />
          </div>
        ) : null}

        {messages.data ? (
          <PaginationControls
            page={messages.data.page}
            pageSize={messages.data.pageSize}
            total={messages.data.total}
            onPageChange={setPage}
          />
        ) : null}
      </article>
    </section>
  );
}
