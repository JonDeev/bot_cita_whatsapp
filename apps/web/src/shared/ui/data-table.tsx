import type { ReactNode } from 'react';
import { StateMessage, TableEmptyRow } from './state-messages';

export interface DataTableColumn<TItem> {
  id: string;
  header: ReactNode;
  cell: (item: TItem) => ReactNode;
  headerClassName?: string;
  cellClassName?: string;
}

interface DataTableProps<TItem> {
  columns: DataTableColumn<TItem>[];
  items: TItem[];
  getRowKey: (item: TItem, index: number) => string | number;
  emptyTitle: string;
  emptyDescription?: string;
  isLoading?: boolean;
  isError?: boolean;
  loadingTitle?: string;
  errorTitle?: string;
  errorDescription?: string;
}

export function DataTable<TItem>({
  columns,
  items,
  getRowKey,
  emptyTitle,
  emptyDescription,
  isLoading = false,
  isError = false,
  loadingTitle = 'Cargando datos...',
  errorTitle = 'No fue posible cargar los datos.',
  errorDescription = 'Reintenta en unos segundos.',
}: DataTableProps<TItem>) {
  const emptyRowProps: { colSpan: number; title: string; description?: string } = {
    colSpan: columns.length,
    title: emptyTitle,
  };

  if (emptyDescription) {
    emptyRowProps.description = emptyDescription;
  }

  return (
    <>
      <table className="min-w-full text-left text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-xs uppercase tracking-[0.12em] text-[var(--muted)]">
            {columns.map((column) => (
              <th className={column.headerClassName ?? 'px-2 py-2'} key={column.id}>
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => (
            <tr className="border-b border-slate-100" key={getRowKey(item, index)}>
              {columns.map((column) => (
                <td className={column.cellClassName ?? 'px-2 py-2'} key={column.id}>
                  {column.cell(item)}
                </td>
              ))}
            </tr>
          ))}
          {items.length === 0 ? (
            <TableEmptyRow {...emptyRowProps} />
          ) : null}
        </tbody>
      </table>

      {isLoading ? (
        <div className="mt-3">
          <StateMessage title={loadingTitle} />
        </div>
      ) : null}

      {isError ? (
        <div className="mt-3">
          <StateMessage
            title={errorTitle}
            description={errorDescription}
            tone="danger"
          />
        </div>
      ) : null}
    </>
  );
}
