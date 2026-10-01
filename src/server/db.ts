import mysql, { type Connection, type RowDataPacket } from "mysql2/promise";
import { parseConnection } from "@/lib/storage";
import type { DbConnection } from "@/lib/types";

export async function withDb<T>(
  input: unknown,
  fn: (connection: Connection, config: DbConnection) => Promise<T>,
): Promise<T> {
  const config = parseConnection(input);
  if (!config) {
    throw new DbClientError("Informe host, porta, usuário, senha e database.", 400);
  }
  const connection = await mysql.createConnection({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    database: config.database,
    connectTimeout: 12000,
    ssl: config.ssl ? { rejectUnauthorized: false } : undefined,
    enableCleartextPlugin: config.iamCleartext,
    multipleStatements: false,
  });
  try {
    return await fn(connection, config);
  } finally {
    await connection.end();
  }
}

export class DbClientError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export function toErrorResponse(error: unknown): { status: number; message: string } {
  if (error instanceof DbClientError) {
    return { status: error.status, message: error.message };
  }
  if (error && typeof error === "object" && "code" in error) {
    const code = String(error.code);
    if (code === "ER_ACCESS_DENIED_ERROR") {
      return {
        status: 401,
        message:
          "Acesso negado. O token IAM costuma expirar em 15 minutos. Atualize só a senha.",
      };
    }
    if (code === "ECONNREFUSED" || code === "ETIMEDOUT" || code === "ENOTFOUND" || code === "PROTOCOL_CONNECTION_LOST") {
      return { status: 503, message: "Não foi possível conectar no host informado." };
    }
    if (code === "ER_NO_REFERENCED_ROW_2" || code === "ER_NO_REFERENCED_ROW") {
      return { status: 400, message: "Perfil, escopo ou application_id não existe no banco." };
    }
  }
  return { status: 500, message: "Falha ao falar com o banco." };
}

export type SqlRow = RowDataPacket;
