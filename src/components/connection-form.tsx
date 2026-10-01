"use client";

import { useState, useSyncExternalStore, type FormEvent } from "react";
import { ApiError, dbFetch } from "@/components/db-context";
import { fieldClass, labelClass } from "@/components/field";
import { parseMysqlUrl } from "@/lib/mysql-url";
import {
  getConnectionDraftSnapshot,
  getServerConnectionDraftSnapshot,
  subscribeConnection,
  type ConnectionDraft,
} from "@/lib/storage";
import type { DbConnection } from "@/lib/types";

interface ConnectionFormProps {
  initial: DbConnection | null;
  message: string | null;
  onSaved: (connection: DbConnection, draft: ConnectionDraft) => void;
  onForget: () => void;
}

const empty: DbConnection = {
  host: "127.0.0.1",
  port: 3306,
  user: "",
  password: "",
  database: "medcof",
  ssl: true,
  iamCleartext: true,
};

export function ConnectionForm({ initial, message, onSaved, onForget }: ConnectionFormProps) {
  const storedDraft = useSyncExternalStore(
    subscribeConnection,
    getConnectionDraftSnapshot,
    getServerConnectionDraftSnapshot,
  );
  const [mode, setMode] = useState<"fields" | "string">(storedDraft.inputMode);
  const [connectionString, setConnectionString] = useState(storedDraft.connectionString);
  const [seenDraft, setSeenDraft] = useState(storedDraft);
  const [form, setForm] = useState<DbConnection>(initial ?? empty);
  const [error, setError] = useState<string | null>(message);
  const [pending, setPending] = useState(false);
  if (storedDraft !== seenDraft) {
    setSeenDraft(storedDraft);
    setMode(storedDraft.inputMode);
    setConnectionString(storedDraft.connectionString);
  }
  const parsedString = mode === "string" ? parseMysqlUrl(connectionString) : null;

  function update<K extends keyof DbConnection>(key: K, value: DbConnection[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const draft: ConnectionDraft = { inputMode: mode, connectionString };
    const connection =
      mode === "string"
        ? parsedString
          ? { ...parsedString, ssl: form.ssl, iamCleartext: form.iamCleartext }
          : null
        : form;
    if (!connection) {
      setError("String MySQL inválida. Use mysql://usuário:senha@host:porta/database");
      return;
    }
    setPending(true);
    setError(null);
    try {
      await dbFetch<{ ok: true }>("/api/ping", connection);
      onSaved(connection, draft);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Não foi possível conectar.");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-full w-full max-w-xl flex-1 items-center px-4 py-10">
      <form
        onSubmit={submit}
        className="w-full rounded-xl border border-[var(--line)] bg-[var(--panel)] p-6 shadow-sm"
      >
        <p className="text-xs font-medium tracking-[0.14em] text-[var(--accent)] uppercase">
          Qbank
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Liberador de rotas</h1>
        <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
          A senha fica no localStorage deste navegador e só sai da máquina para o MySQL
          que você apontar. Token IAM expira em cerca de 15 minutos.
        </p>
        {error ? (
          <p className="mt-4 rounded-md bg-[var(--danger-bg)] px-3 py-2 text-sm text-[var(--danger)]">
            {error}
          </p>
        ) : null}
        <div className="mt-5 flex rounded-md border border-[var(--line)] p-1 text-sm">
          <button
            type="button"
            className={`h-9 flex-1 rounded ${mode === "fields" ? "bg-[var(--accent)] text-[var(--accent-ink)]" : ""}`}
            onClick={() => setMode("fields")}
          >
            Campo a campo
          </button>
          <button
            type="button"
            className={`h-9 flex-1 rounded ${mode === "string" ? "bg-[var(--accent)] text-[var(--accent-ink)]" : ""}`}
            onClick={() => setMode("string")}
          >
            String de conexão
          </button>
        </div>
        {mode === "fields" ? (
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="sm:col-span-2">
            <span className={labelClass}>Host</span>
            <input className={fieldClass} value={form.host} onChange={(event) => update("host", event.target.value)} required />
          </label>
          <label>
            <span className={labelClass}>Porta</span>
            <input
              className={fieldClass}
              type="number"
              min={1}
              max={65535}
              value={form.port}
              onChange={(event) => update("port", Number(event.target.value))}
              required
            />
          </label>
          <label>
            <span className={labelClass}>Database</span>
            <input className={fieldClass} value={form.database} onChange={(event) => update("database", event.target.value)} required />
          </label>
          <label>
            <span className={labelClass}>Usuário</span>
            <input className={fieldClass} value={form.user} onChange={(event) => update("user", event.target.value)} required autoComplete="username" />
          </label>
          <label>
            <span className={labelClass}>Senha ou token IAM</span>
            <input
              className={fieldClass}
              type="password"
              value={form.password}
              onChange={(event) => update("password", event.target.value)}
              required
              autoComplete="current-password"
            />
          </label>
        </div>
        ) : (
          <>
          <label className="mt-5 block">
            <span className={labelClass}>mysql://</span>
            <textarea
              className={`${fieldClass} h-28 py-2 font-mono text-xs`}
              value={connectionString}
              placeholder="mysql://usuario:senha@127.0.0.1:26524/medcof?sslmode=require"
              spellCheck={false}
              onChange={(event) => {
                const next = event.target.value;
                setConnectionString(next);
                const parsed = parseMysqlUrl(next);
                if (!parsed) return;
                setForm((current) => ({ ...current, ...parsed }));
              }}
            />
          </label>
          {connectionString.trim() && !parsedString ? (
            <p className="mt-2 text-sm text-[var(--danger)]">Não consegui ler essa string.</p>
          ) : null}
          {parsedString ? (
            <p className="mt-2 font-mono text-xs text-[var(--muted)]">
              {parsedString.user}@{parsedString.host}:{parsedString.port}/{parsedString.database}
            </p>
          ) : null}
          </>
        )}
        <div className="mt-4 flex flex-col gap-2 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={form.ssl} onChange={(event) => update("ssl", event.target.checked)} />
            SSL
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={form.iamCleartext}
              onChange={(event) => update("iamCleartext", event.target.checked)}
            />
            Autenticação IAM (cleartext plugin)
          </label>
        </div>
        <div className="mt-6 flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={pending}
            className="h-10 rounded-md bg-[var(--accent)] px-4 text-sm font-medium text-[var(--accent-ink)] disabled:opacity-60"
          >
            {pending ? "Testando…" : "Testar e salvar"}
          </button>
          {initial ? (
            <button
              type="button"
              className="h-10 rounded-md border border-[var(--line)] px-4 text-sm"
              onClick={onForget}
            >
              Esquecer conexão
            </button>
          ) : null}
        </div>
      </form>
    </main>
  );
}
