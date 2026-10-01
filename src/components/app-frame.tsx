"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { ConnectionForm } from "@/components/connection-form";
import { ApiError, DbContext, dbFetch } from "@/components/db-context";
import {
  forgetStoredConnection,
  getConnectionSnapshot,
  getServerConnectionSnapshot,
  persistConnection,
  subscribeConnection,
} from "@/lib/storage";
import type { EscopoOption, PerfilOption } from "@/lib/types";

const NAV = [
  { href: "/rotas", label: "Rotas" },
  { href: "/escopos", label: "Escopos" },
  { href: "/liberar", label: "Liberar" },
];

export function AppFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const connection = useSyncExternalStore(
    subscribeConnection,
    getConnectionSnapshot,
    getServerConnectionSnapshot,
  );
  const [editing, setEditing] = useState(false);
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const [perfis, setPerfis] = useState<PerfilOption[]>([]);
  const [escopos, setEscopos] = useState<EscopoOption[]>([]);
  const [optionsError, setOptionsError] = useState<string | null>(null);

  const openConnection = useCallback((message?: string) => {
    setAuthMessage(message ?? null);
    setEditing(true);
  }, []);

  const forgetConnection = useCallback(() => {
    forgetStoredConnection();
    setPerfis([]);
    setEscopos([]);
    setAuthMessage(null);
    setEditing(false);
  }, []);

  useEffect(() => {
    if (!connection || editing) return;
    let cancelled = false;
    dbFetch<{ perfis: PerfilOption[]; escopos: EscopoOption[] }>("/api/opcoes", connection)
      .then((result) => {
        if (cancelled) return;
        setPerfis(result.perfis);
        setEscopos(result.escopos);
        setOptionsError(null);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        if (error instanceof ApiError && error.status === 401) {
          openConnection(error.message);
          return;
        }
        setOptionsError(error instanceof Error ? error.message : "Falha ao carregar perfis e escopos.");
      });
    return () => {
      cancelled = true;
    };
  }, [connection, editing, openConnection]);

  if (!connection || editing) {
    return (
      <ConnectionForm
        initial={connection}
        message={authMessage}
        onSaved={(value, draft) => {
          persistConnection(value, draft);
          setEditing(false);
          setAuthMessage(null);
        }}
        onForget={forgetConnection}
      />
    );
  }

  return (
    <DbContext.Provider
      value={{ connection, perfis, escopos, optionsError, openConnection, forgetConnection }}
    >
      <div className="flex min-h-full flex-1 flex-col">
        <header className="border-b border-[var(--line)] bg-[var(--panel)]">
          <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-4 px-4 py-3">
            <div className="mr-auto">
              <p className="text-sm font-semibold tracking-tight">Liberador de rotas</p>
              <p className="font-mono text-xs text-[var(--muted)]">
                {connection.host}:{connection.port} / {connection.database}
              </p>
            </div>
            <nav className="flex gap-1">
              {NAV.map((item) => {
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`rounded-md px-3 py-1.5 text-sm ${active ? "bg-[var(--accent)] text-[var(--accent-ink)]" : "hover:bg-[#efe8da]"}`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
            <button type="button" className="text-sm text-[var(--muted)] underline" onClick={() => openConnection()}>
              Conexão
            </button>
          </div>
        </header>
        {optionsError ? (
          <p className="bg-[var(--danger-bg)] px-4 py-2 text-sm text-[var(--danger)]">{optionsError}</p>
        ) : null}
        <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</div>
      </div>
    </DbContext.Provider>
  );
}
