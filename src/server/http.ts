import { NextResponse } from "next/server";
import { toErrorResponse, withDb } from "@/server/db";
import type { Connection } from "mysql2/promise";
import type { DbConnection } from "@/lib/types";

export async function handleDbPost(
  request: Request,
  handler: (
    connection: Connection,
    config: DbConnection,
    body: Record<string, unknown>,
  ) => Promise<unknown>,
): Promise<NextResponse> {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const payload = await withDb(body.connection, (connection, config) =>
      handler(connection, config, body),
    );
    return NextResponse.json(payload);
  } catch (error) {
    const mapped = toErrorResponse(error);
    return NextResponse.json({ message: mapped.message }, { status: mapped.status });
  }
}

export function pageParams(body: Record<string, unknown>): { page: number; pageSize: number; offset: number } {
  const requestedPage = Number(body.page);
  const requestedSize = Number(body.pageSize);
  const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const pageSize = requestedSize === 50 ? 50 : 20;
  return { page, pageSize, offset: (page - 1) * pageSize };
}

export function optionalId(value: unknown): number | null {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) return null;
  return parsed;
}

export function optionalText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}
