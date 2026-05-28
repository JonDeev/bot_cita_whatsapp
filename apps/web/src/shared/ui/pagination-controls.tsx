interface PaginationControlsProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (nextPage: number) => void;
}

export function PaginationControls({
  page,
  pageSize,
  total,
  onPageChange,
}: PaginationControlsProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="mt-4 flex items-center justify-between gap-3 text-sm">
      <p className="text-[var(--muted)]">
        Pagina {page} de {totalPages} · {total} registros
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page <= 1}
          className="rounded-lg border border-[var(--border)] px-3 py-1 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Anterior
        </button>
        <button
          type="button"
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          disabled={page >= totalPages}
          className="rounded-lg border border-[var(--border)] px-3 py-1 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Siguiente
        </button>
      </div>
    </div>
  );
}
