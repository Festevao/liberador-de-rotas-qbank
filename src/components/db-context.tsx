"use client";

import { createContext, useContext } from "react";
import type { DbConnection, EscopoOption, PerfilOption } from "@/lib/types";

interface DbContextValue {
  connection: DbConnection;
  perfis: PerfilOption[];
  escopos: EscopoOption[];
  optionsError: string | null;
  openConnection: (message?: string) => void;
  forgetConnection: () => void;
}

export const DbContext = createContext<DbContextValue | null>(null);

export function useDb(): DbContextValue {
  const value = useContext(DbContext);
  if (!value) {
    throw new Error("Conexão ainda não está pronta.");
  }
  return value;
}

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function dbFetch<T>(
  path: string,
  connection: DbConnection,
  body: Record<string, unknown> = {},
): Promise<T> {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ connection, ...body }),
  });
  const data = (await response.json()) as T & { message?: string };
  if (!response.ok) {
    throw new ApiError(data.message ?? "Erro ao consultar o banco.", response.status);
  }
  return data;
}
