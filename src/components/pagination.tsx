"use client";

interface PaginationProps {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  onPage: (page: number) => void;
  onPageSize: (pageSize: number) => void;
}

export function Pagination({
  page,
  totalPages,
  total,
  pageSize,
  onPage,
  onPageSize,
}: PaginationProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
      <span className="text-[var(--muted)]">{total} registros</span>
      <div className="flex items-center gap-2">
        <label className="text-[var(--muted)]">
          Por página
          <select
            className="ml-2 h-9 rounded-md border border-[var(--line)] bg-white px-2"
            value={pageSize}
            onChange={(event) => onPageSize(Number(event.target.value))}
          >
            <option value={20}>20</option>
            <option value={50}>50</option>
          </select>
        </label>
        <button
          type="button"
          className="h-9 rounded-md border border-[var(--line)] bg-white px-3 disabled:opacity-40"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
        >
          Anterior
        </button>
        <span>
          {page} / {totalPages}
        </span>
        <button
          type="button"
          className="h-9 rounded-md border border-[var(--line)] bg-white px-3 disabled:opacity-40"
          disabled={page >= totalPages}
          onClick={() => onPage(page + 1)}
        >
          Próxima
        </button>
      </div>
    </div>
  );
}
