"use client";

import { useEffect, useState } from "react";
import { ApiError, dbFetch, useDb } from "@/components/db-context";
import { fieldClass, labelClass } from "@/components/field";
import { Pagination } from "@/components/pagination";
import { SearchSelect } from "@/components/search-select";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { APPLICATIONS, METHODS, type PageResult, type RotaRow } from "@/lib/types";

export function RotasScreen() {
  const { connection, openConnection, perfis, escopos } = useDb();
  const [id, setId] = useState("");
  const [path, setPath] = useState("");
  const [observacao, setObservacao] = useState("");
  const [method, setMethod] = useState("");
  const [escopoId, setEscopoId] = useState("");
  const [perfilId, setPerfilId] = useState("");
  const [status, setStatus] = useState("");
  const [applicationId, setApplicationId] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const filterKey = useDebouncedValue(
    JSON.stringify({ id, path, observacao, method, escopoId, perfilId, status, applicationId }),
  );
  const [result, setResult] = useState<PageResult<RotaRow> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const requestKey = `${filterKey}|${page}|${pageSize}`;
  const [seenFilter, setSeenFilter] = useState(`${filterKey}|${pageSize}`);
  if (seenFilter !== `${filterKey}|${pageSize}`) {
    setSeenFilter(`${filterKey}|${pageSize}`);
    setPage(1);
  }

  useEffect(() => {
    let cancelled = false;
    const filters = JSON.parse(filterKey) as Record<string, string>;
    dbFetch<PageResult<RotaRow>>("/api/rotas", connection, { page, pageSize, ...filters })
      .then((data) => {
        if (cancelled) return;
        setResult(data);
        setError(null);
        setLoadedKey(requestKey);
      })
      .catch((caught: unknown) => {
        if (cancelled) return;
        if (caught instanceof ApiError && caught.status === 401) openConnection(caught.message);
        setError(caught instanceof Error ? caught.message : "Erro ao listar rotas.");
        setLoadedKey(requestKey);
      });
    return () => {
      cancelled = true;
    };
  }, [connection, page, pageSize, filterKey, openConnection, requestKey]);

  const loading = loadedKey !== requestKey;

  return (
    <section>
      <h1 className="text-xl font-semibold tracking-tight">Rotas liberadas</h1>
      <p className="mt-1 text-sm text-[var(--muted)]">
        perfil_recurso com os perfis ativos em perfil_controle. A busca espera 300 ms.
      </p>
      <div className="mt-4 grid gap-3 md:grid-cols-4">
        <label>
          <span className={labelClass}>Id</span>
          <input className={fieldClass} value={id} onChange={(event) => setId(event.target.value)} inputMode="numeric" />
        </label>
        <label>
          <span className={labelClass}>Path</span>
          <input className={fieldClass} value={path} onChange={(event) => setPath(event.target.value)} />
        </label>
        <label>
          <span className={labelClass}>Observação</span>
          <input className={fieldClass} value={observacao} onChange={(event) => setObservacao(event.target.value)} />
        </label>
        <label>
          <span className={labelClass}>Method</span>
          <select className={fieldClass} value={method} onChange={(event) => setMethod(event.target.value)}>
            <option value="">Todos</option>
            {METHODS.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <SearchSelect
          label="Escopo"
          value={escopoId}
          onChange={setEscopoId}
          options={escopos.map((item) => ({ value: String(item.id), label: item.nome }))}
          placeholder="Nome ou id"
        />
        <SearchSelect
          label="Perfil"
          value={perfilId}
          onChange={setPerfilId}
          options={perfis.map((item) => ({ value: String(item.id), label: item.nome }))}
          placeholder="Nome ou id"
        />
        <label>
          <span className={labelClass}>Status</span>
          <select className={fieldClass} value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">Todos</option>
            <option value="1">Ativo</option>
            <option value="0">Inativo</option>
          </select>
        </label>
        <label>
          <span className={labelClass}>Application</span>
          <select className={fieldClass} value={applicationId} onChange={(event) => setApplicationId(event.target.value)}>
            <option value="">Todas</option>
            {APPLICATIONS.map((item) => (
              <option key={item.id} value={item.id}>
                {item.id} · {item.nome}
              </option>
            ))}
          </select>
        </label>
      </div>
      {error ? <p className="mt-4 text-sm text-[var(--danger)]">{error}</p> : null}
      <div className="mt-4 overflow-x-auto rounded-lg border border-[var(--line)] bg-[var(--panel)]">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead className="bg-[#f6f1e7] text-xs tracking-wide text-[var(--muted)] uppercase">
            <tr>
              <th className="px-3 py-2">Id</th>
              <th className="px-3 py-2">Method</th>
              <th className="px-3 py-2">Path</th>
              <th className="px-3 py-2">Observação</th>
              <th className="px-3 py-2">Escopo</th>
              <th className="px-3 py-2">Perfis</th>
            </tr>
          </thead>
          <tbody>
            {result?.items.map((item) => (
              <tr key={item.id} className="border-t border-[var(--line)] align-top">
                <td className="px-3 py-2 font-mono">{item.id}</td>
                <td className="px-3 py-2 font-mono whitespace-pre">
                  {item.method}
                  {item.method !== item.method.trim() ? " ·" : ""}
                  {item.status === 1 ? "" : " inativo"}
                </td>
                <td className="max-w-sm px-3 py-2 font-mono text-xs break-all">{item.path}</td>
                <td className="px-3 py-2">{item.observacao}</td>
                <td className="px-3 py-2">
                  {item.escopoNome}
                  <span className="mt-1 block text-xs text-[var(--muted)]">app {item.applicationId}</span>
                </td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-1">
                    {item.perfis.map((perfil) => (
                      <span key={perfil.id} className="rounded bg-[#efe8da] px-1.5 py-0.5 text-xs">
                        {perfil.id} {perfil.nome}
                      </span>
                    ))}
                    {item.perfis.length === 0 ? <span className="text-[var(--muted)]">Nenhum</span> : null}
                  </div>
                </td>
              </tr>
            ))}
            {!loading && result?.items.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-[var(--muted)]">
                  Nenhuma rota encontrada.
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
            onPageSize={(size) => setPageSize(size)}
          />
        </div>
      ) : null}
    </section>
  );
}
