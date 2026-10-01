"use client";

import { useEffect, useState } from "react";
import { ApiError, dbFetch, useDb } from "@/components/db-context";
import { fieldClass, labelClass } from "@/components/field";
import { Pagination } from "@/components/pagination";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import type { EscopoRow, PageResult } from "@/lib/types";

export function EscoposScreen() {
  const { connection, openConnection } = useDb();
  const [id, setId] = useState("");
  const [nome, setNome] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const debouncedId = useDebouncedValue(id);
  const debouncedNome = useDebouncedValue(nome);
  const debouncedStatus = useDebouncedValue(status);
  const [result, setResult] = useState<PageResult<EscopoRow> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);

  const filterKey = JSON.stringify({
    id: debouncedId,
    nome: debouncedNome,
    status: debouncedStatus,
  });
  const requestKey = `${filterKey}|${page}|${pageSize}`;
  const [seenFilter, setSeenFilter] = useState(filterKey);
  if (seenFilter !== filterKey) {
    setSeenFilter(filterKey);
    setPage(1);
  }

  useEffect(() => {
    let cancelled = false;
    dbFetch<PageResult<EscopoRow>>("/api/escopos", connection, {
      page,
      pageSize,
      id: debouncedId,
      nome: debouncedNome,
      status: debouncedStatus,
    })
      .then((data) => {
        if (cancelled) return;
        setResult(data);
        setError(null);
        setLoadedKey(requestKey);
      })
      .catch((caught: unknown) => {
        if (cancelled) return;
        if (caught instanceof ApiError && caught.status === 401) openConnection(caught.message);
        setError(caught instanceof Error ? caught.message : "Erro ao listar escopos.");
        setLoadedKey(requestKey);
      });
    return () => {
      cancelled = true;
    };
  }, [connection, page, pageSize, debouncedId, debouncedNome, debouncedStatus, openConnection, requestKey]);

  const loading = loadedKey !== requestKey;

  return (
    <section>
      <h1 className="text-xl font-semibold tracking-tight">Escopos</h1>
      <p className="mt-1 text-sm text-[var(--muted)]">perfil_recurso_escopo, sem registros removidos.</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <label>
          <span className={labelClass}>Id</span>
          <input className={fieldClass} value={id} onChange={(event) => setId(event.target.value)} inputMode="numeric" />
        </label>
        <label>
          <span className={labelClass}>Nome</span>
          <input className={fieldClass} value={nome} onChange={(event) => setNome(event.target.value)} />
        </label>
        <label>
          <span className={labelClass}>Status</span>
          <select className={fieldClass} value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">Todos</option>
            <option value="1">Ativo</option>
            <option value="0">Inativo</option>
          </select>
        </label>
      </div>
      {error ? <p className="mt-4 text-sm text-[var(--danger)]">{error}</p> : null}
      <div className="mt-4 overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--panel)]">
        <table className="w-full text-left text-sm">
          <thead className="bg-[#f6f1e7] text-xs tracking-wide text-[var(--muted)] uppercase">
            <tr>
              <th className="px-3 py-2">Id</th>
              <th className="px-3 py-2">Nome</th>
              <th className="px-3 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {result?.items.map((item) => (
              <tr key={item.id} className="border-t border-[var(--line)]">
                <td className="px-3 py-2 font-mono">{item.id}</td>
                <td className="px-3 py-2">{item.nome}</td>
                <td className="px-3 py-2">{item.status === 1 ? "Ativo" : "Inativo"}</td>
              </tr>
            ))}
            {!loading && result?.items.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-3 py-6 text-[var(--muted)]">
                  Nenhum escopo encontrado.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      {loading ? <p className="mt-3 text-sm text-[var(--muted)]">Buscando…</p> : null}
      {result ? (
        <div className="mt-4">
          <Pagination
            page={result.page}
            totalPages={result.totalPages}
            total={result.total}
            pageSize={pageSize}
            onPage={setPage}
            onPageSize={(size) => {
              setPageSize(size);
              setPage(1);
            }}
          />
        </div>
      ) : null}
    </section>
  );
}
