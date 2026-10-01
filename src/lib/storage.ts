import type { DbConnection } from "@/lib/types";

export const CONNECTION_STORAGE_KEY = "liberador.connection";

export function readConnection(): DbConnection | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(CONNECTION_STORAGE_KEY);
  if (!raw) return null;
  try {
    return parseConnection(JSON.parse(raw));
  } catch {
    return null;
  }
}

export interface ConnectionDraft {
  inputMode: "fields" | "string";
  connectionString: string;
}

export function saveConnection(connection: DbConnection, draft?: ConnectionDraft): void {
  window.localStorage.setItem(
    CONNECTION_STORAGE_KEY,
    JSON.stringify({ ...connection, ...draft }),
  );
}

const emptyDraft: ConnectionDraft = { inputMode: "fields", connectionString: "" };
let draftSnapshot: ConnectionDraft = emptyDraft;
let draftLoaded = false;

export function readConnectionDraft(): ConnectionDraft {
  if (typeof window === "undefined") return emptyDraft;
  const raw = window.localStorage.getItem(CONNECTION_STORAGE_KEY);
  if (!raw) return emptyDraft;
  try {
    const value = JSON.parse(raw) as Record<string, unknown>;
    return {
      inputMode: value.inputMode === "string" ? "string" : "fields",
      connectionString: typeof value.connectionString === "string" ? value.connectionString : "",
    };
  } catch {
    return emptyDraft;
  }
}

export function getConnectionDraftSnapshot(): ConnectionDraft {
  if (!draftLoaded) {
    draftSnapshot = readConnectionDraft();
    draftLoaded = true;
  }
  return draftSnapshot;
}

export function getServerConnectionDraftSnapshot(): ConnectionDraft {
  return emptyDraft;
}

export function clearConnection(): void {
  window.localStorage.removeItem(CONNECTION_STORAGE_KEY);
}

const listeners = new Set<() => void>();
let current: DbConnection | null | undefined;

function emitConnection(): void {
  listeners.forEach((listener) => listener());
}

export function subscribeConnection(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getConnectionSnapshot(): DbConnection | null {
  if (current === undefined) current = readConnection();
  return current;
}

export function getServerConnectionSnapshot(): null {
  return null;
}

export function persistConnection(connection: DbConnection, draft?: ConnectionDraft): void {
  saveConnection(connection, draft);
  current = connection;
  if (draft) {
    draftSnapshot = draft;
    draftLoaded = true;
  }
  emitConnection();
}

export function forgetStoredConnection(): void {
  clearConnection();
  current = null;
  draftSnapshot = emptyDraft;
  draftLoaded = true;
  emitConnection();
}

export function parseConnection(input: unknown): DbConnection | null {
  if (!input || typeof input !== "object") return null;
  const value = input as Record<string, unknown>;
  const host = stringValue(value.host);
  const user = stringValue(value.user);
  const password = typeof value.password === "string" ? value.password : "";
  const database = stringValue(value.database);
  const port = Number(value.port);
  if (!host || !user || !password || !database) return null;
  if (!Number.isInteger(port) || port < 1 || port > 65535) return null;
  return {
    host,
    port,
    user,
    password,
    database,
    ssl: value.ssl !== false,
    iamCleartext: value.iamCleartext !== false,
  };
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}
