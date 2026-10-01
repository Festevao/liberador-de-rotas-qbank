"use client";

import { useMemo, useState } from "react";
import { ApiError, dbFetch, useDb } from "@/components/db-context";
import { fieldClass, labelClass } from "@/components/field";
import { PathField } from "@/components/path-field";
import { SearchSelect } from "@/components/search-select";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { composePath, type PathUnit } from "@/lib/path-editor";
import { copyInsertSql, copyKnexMigration } from "@/lib/sql";
import {
  APPLICATIONS,
  METHODS,
  type Collision,
  type LiberarResponse,
} from "@/lib/types";

interface RouteRow {
  id: string;
  method: string;
  units: PathUnit[];
  caret: number;
  observacao: string;
}

interface ReadyRoute {
  id: string;
  method: string;
  observacao: string;
  storedPath: string;
  samplePath: string;
  error?: string;
  truncated: boolean;
}

export function ReleaseScreen() {
  const { connection, openConnection, perfis, escopos } = useDb();
  const [profileIds, setProfileIds] = useState<number[]>([]);
  const [profileSearch, setProfileSearch] = useState("");
  const debouncedProfileSearch = useDebouncedValue(profileSearch);
  const [scopeId, setScopeId] = useState("");
  const [applicationId, setApplicationId] = useState("1");
  const [rows, setRows] = useState<RouteRow[]>(() => [emptyRow()]);
  const [activeRowId, setActiveRowId] = useState<string | null>(null);
  const [testMethod, setTestMethod] = useState("GET");
  const [testPath, setTestPath] = useState("");
  const [matches, setMatches] = useState<Collision[] | null>(null);
  const [testedPath, setTestedPath] = useState("");
  const [preview, setPreview] = useState<LiberarResponse | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [copied, setCopied] = useState("");

  const routes = useMemo(() => rows.map(describeRow), [rows]);
  const validRoutes = routes.filter((route) => !route.error);
  const visiblePerfis = perfis.filter((perfil) => {
    const term = debouncedProfileSearch.trim().toLowerCase();
    if (!term) return true;
    return perfil.nome.toLowerCase().includes(term) || String(perfil.id).includes(term);
  });

  function toggleProfile(id: number) {
    setProfileIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  }

  function updateRow(id: string, patch: Partial<RouteRow>) {
    setRows((current) => current.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }

  function addRow(afterId: string) {
    const source = rows.find((row) => row.id === afterId);
    const next = emptyRow(source?.method ?? "GET");
    setRows((current) => {
      const index = current.findIndex((row) => row.id === afterId);
      if (index < 0) return [...current, next];
      return [...current.slice(0, index + 1), next, ...current.slice(index + 1)];
    });
    setActiveRowId(next.id);
  }

  function removeRow(id: string) {
    setRows((current) => (current.length === 1 ? current : current.filter((row) => row.id !== id)));
  }

  async function testUrl() {
    setError(null);
    setMatches(null);
    try {
      const result = await dbFetch<{ path: string; matches: Collision[] }>("/api/testar", connection, {
        method: testMethod,
        path: testPath,
      });
      setTestedPath(result.path);
      setMatches(result.matches);
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 401) openConnection(caught.message);
      setError(caught instanceof Error ? caught.message : "Falha ao testar a URL.");
    }
  }

  async function analyze(dryRun: boolean) {
    setPending(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await dbFetch<LiberarResponse>("/api/liberar", connection, {
        dryRun,
        profileIds,
        scopeId: Number(scopeId),
        applicationId: Number(applicationId),
        routes: validRoutes.map((route) => ({
          method: route.method,
          storedPath: route.storedPath,
          samplePath: route.samplePath,
          observacao: route.observacao,
        })),
      });
      if (dryRun) {
        setPreview(result);
      } else {
        setPreview(null);
        setSuccess(
          result.items
            .map((item) => `${item.action === "criar" ? "Criada" : "Vinculada"} ${item.id} ${item.method} ${item.path}`)
            .join("\n"),
        );
      }
    } catch (caught) {
      setPreview(null);
      if (caught instanceof ApiError && caught.status === 401) openConnection(caught.message);
      setError(caught instanceof Error ? caught.message : "Falha ao liberar.");
    } finally {
      setPending(false);
    }
  }

  async function copy(kind: "sql" | "knex") {
    const payload = validRoutes.map((route) => ({
      method: route.method,
      storedPath: route.storedPath,
      observacao: route.observacao,
    }));
    const ids = profileIds;
    const scope = Number(scopeId);
    const application = Number(applicationId);
    const value =
      kind === "sql"
        ? copyInsertSql(payload, ids, scope, application)
        : copyKnexMigration(payload, ids, scope, application);
    await navigator.clipboard.writeText(value);
    setCopied(kind);
  }

  const canSubmit =
    profileIds.length > 0 &&
    scopeId !== "" &&
    validRoutes.length > 0 &&
    validRoutes.length === routes.length;

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Liberar rotas</h1>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-[var(--muted)]">
          O middleware compara a URL com <span className="font-mono">REGEXP CONCAT(&apos;^&apos;, path)</span>.
          O valor gravado fica sem <span className="font-mono">^</span> e com <span className="font-mono">$</span> no fim.
          O perfil 5 (Super Administrador) passa sem olhar a tabela.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <div className="rounded-lg border border-[var(--line)] bg-[var(--panel)] p-3">
          <label>
            <span className={labelClass}>Filtrar perfis</span>
            <input className={fieldClass} value={profileSearch} onChange={(event) => setProfileSearch(event.target.value)} />
          </label>
          <ul className="mt-3 max-h-80 space-y-1 overflow-auto">
            {visiblePerfis.map((perfil) => (
              <li key={perfil.id}>
                <label className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={profileIds.includes(perfil.id)}
                    onChange={() => toggleProfile(perfil.id)}
                  />
                  <span>
                    <span className="font-mono text-xs text-[var(--muted)]">{perfil.id}</span> {perfil.nome}
                    {perfil.id === 5 ? (
                      <span className="mt-0.5 block text-xs text-[var(--warn)]">Ignora a tabela no middleware.</span>
                    ) : null}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </div>
        <div className="grid content-start gap-4">
          <SearchSelect
            label="Escopo"
            value={scopeId}
            onChange={setScopeId}
            allowEmpty={false}
            emptyLabel="Escolha o escopo"
            placeholder="Nome ou id do escopo"
            options={escopos.map((item) => ({
              value: String(item.id),
              label: `${item.nome}${item.status === 1 ? "" : " (inativo)"}`,
            }))}
          />
          <label>
            <span className={labelClass}>Application</span>
            <select className={fieldClass} value={applicationId} onChange={(event) => setApplicationId(event.target.value)}>
              {APPLICATIONS.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.id} · {item.nome}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="space-y-4">
        <p className="text-xs leading-5 text-[var(--muted)]">
          O que você digita no path é literal. MongoId, numérico e o regex próprio entram como um bloco:
          Backspace e Delete apagam o bloco inteiro, sem editar por dentro.
        </p>
        {rows.map((row) => {
          const route = routes.find((item) => item.id === row.id);
          return (
            <div key={row.id} className="grid items-start gap-2 md:grid-cols-[8rem_minmax(0,1.5fr)_minmax(0,1fr)_auto]">
              <label>
                <span className={labelClass}>Método</span>
                <select
                  className={fieldClass}
                  value={row.method}
                  aria-label="Método HTTP"
                  onChange={(event) => updateRow(row.id, { method: event.target.value })}
                >
                  {METHODS.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>
              <div>
                <span className={labelClass}>Path</span>
                <PathField
                  units={row.units}
                  caret={row.caret}
                  active={activeRowId === row.id}
                  error={row.units.length > 0 ? route?.error : undefined}
                  storedPath={route?.storedPath}
                  onFocus={() => setActiveRowId(row.id)}
                  onChange={(units, caret) => updateRow(row.id, { units, caret })}
                />
              </div>
              <label>
                <span className={labelClass}>Observação</span>
                <input
                  className={fieldClass}
                  value={row.observacao}
                  maxLength={100}
                  placeholder="Se vazio, usa o path"
                  aria-label="Observação da rota"
                  onChange={(event) => updateRow(row.id, { observacao: event.target.value })}
                />
                {route?.truncated ? (
                  <p className="mt-1 text-xs text-[var(--warn)]">Observação cortada em 100 caracteres.</p>
                ) : null}
              </label>
              <div className="flex gap-1 md:pt-5">
                {rows.length > 1 ? (
                  <button
                    type="button"
                    aria-label="Remover rota"
                    className="h-10 w-10 rounded-md border border-[var(--line)] bg-white text-lg"
                    onClick={() => removeRow(row.id)}
                  >
                    ×
                  </button>
                ) : null}
                <button
                  type="button"
                  aria-label="Adicionar rota"
                  className="h-10 w-10 rounded-md border border-[var(--line)] bg-white text-lg"
                  onClick={() => addRow(row.id)}
                >
                  +
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="rounded-lg border border-[var(--line)] bg-[var(--panel)] p-3">
        <h2 className="text-sm font-medium">Testar uma URL no mesmo REGEXP do middleware</h2>
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <label>
            <span className={labelClass}>Method</span>
            <select className={fieldClass} value={testMethod} onChange={(event) => setTestMethod(event.target.value)}>
              {METHODS.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <label className="min-w-[240px] flex-1">
            <span className={labelClass}>Path concreto</span>
            <input
              className={fieldClass}
              value={testPath}
              placeholder="/v3/qbank/15/reset"
              onChange={(event) => setTestPath(event.target.value)}
            />
          </label>
          <button type="button" className="h-10 rounded-md border border-[var(--line)] bg-white px-3 text-sm" onClick={() => void testUrl()}>
            Testar
          </button>
        </div>
        {matches ? (
          <div className="mt-3 text-sm">
            <p className="text-[var(--muted)]">
              Path normalizado: <span className="font-mono">{testedPath}</span>
            </p>
            {matches.length === 0 ? <p className="mt-2">Nenhuma rota ativa casa com isso.</p> : null}
            {matches.length > 1 ? (
              <p className="mt-2 text-[var(--warn)]">
                Mais de uma rota casa. O middleware usa LIMIT 1 sem ordem, então o perfil pode receber a linha errada.
              </p>
            ) : null}
            <ul className="mt-2 space-y-1">
              {matches.map((match) => (
                <li key={match.id} className="font-mono text-xs">
                  {match.id} {match.method} {match.path}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      {error ? <p className="rounded-md bg-[var(--danger-bg)] px-3 py-2 text-sm text-[var(--danger)]">{error}</p> : null}
      {success ? (
        <pre className="overflow-auto rounded-md bg-[var(--ok-bg)] px-3 py-2 text-xs text-[var(--ok)] whitespace-pre-wrap">{success}</pre>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button type="button" className="h-10 rounded-md border border-[var(--line)] bg-white px-3 text-sm" disabled={!canSubmit} onClick={() => void copy("sql")}>
          {copied === "sql" ? "SQL copiado" : "Copiar SQL"}
        </button>
        <button type="button" className="h-10 rounded-md border border-[var(--line)] bg-white px-3 text-sm" disabled={!canSubmit} onClick={() => void copy("knex")}>
          {copied === "knex" ? "Migration copiada" : "Copiar migration Knex"}
        </button>
        <button
          type="button"
          className="h-10 rounded-md bg-[var(--accent)] px-4 text-sm font-medium text-[var(--accent-ink)] disabled:opacity-50"
          disabled={!canSubmit || pending}
          onClick={() => void analyze(true)}
        >
          {pending ? "Analisando…" : "Analisar antes de gravar"}
        </button>
      </div>

      {preview ? (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
          <div className="max-h-[85vh] w-full max-w-2xl overflow-auto rounded-xl bg-[var(--panel)] p-5">
            <h2 className="text-lg font-semibold">Confirmar gravação</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              {preview.host} / {preview.database}. Nada foi gravado ainda.
            </p>
            <ul className="mt-4 space-y-3">
              {preview.items.map((item, index) => (
                <li key={`${index}-${item.method}-${item.path}`} className="rounded-md border border-[var(--line)] p-3 text-sm">
                  <p>
                    {item.action === "criar" ? "Criar" : "Vincular perfis em"}{" "}
                    <span className="font-mono">{item.method}</span>
                  </p>
                  <p className="mt-1 font-mono text-xs break-all">{item.path}</p>
                  {item.collisions.length > 0 ? (
                    <p className="mt-2 text-[var(--warn)]">
                      Uma URL de exemplo também casa com {item.collisions.map((collision) => `#${collision.id}`).join(", ")}.
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                className="h-10 rounded-md bg-[var(--accent)] px-4 text-sm font-medium text-[var(--accent-ink)] disabled:opacity-50"
                disabled={pending}
                onClick={() => void analyze(false)}
              >
                {pending ? "Gravando…" : "Gravar"}
              </button>
              <button type="button" className="h-10 rounded-md border border-[var(--line)] px-4 text-sm" onClick={() => setPreview(null)}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function emptyRow(method = "GET"): RouteRow {
  return { id: crypto.randomUUID(), method, units: [], caret: 0, observacao: "" };
}

function describeRow(row: RouteRow): ReadyRoute {
  const composed = composePath(row.units);
  const typed = row.observacao.trim();
  const source = typed || composed.visible;
  const observacao = source.slice(0, 100);
  return {
    id: row.id,
    method: row.method,
    observacao,
    storedPath: composed.storedPath,
    samplePath: composed.samplePath,
    error: composed.error,
    truncated: source.length > 100,
  };
}
