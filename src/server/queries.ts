import type { Connection, ResultSetHeader } from "mysql2/promise";
import { likeContains } from "@/lib/sql";
import type { Collision, LiberarItemResult, PerfilVinculo } from "@/lib/types";
import { optionalId, optionalText, pageParams } from "@/server/http";
import { DbClientError, type SqlRow } from "@/server/db";

const LIKE = "LIKE ? ESCAPE '\\\\'";

export async function ping(connection: Connection): Promise<{ ok: true }> {
  await connection.query("SELECT 1 AS ok");
  return { ok: true };
}

export async function listOptions(connection: Connection): Promise<{
  perfis: { id: number; nome: string; ativo: number }[];
  escopos: { id: number; nome: string; status: number }[];
}> {
  const [perfis] = await connection.query<SqlRow[]>(
    `SELECT id_perfil AS id, nome, ativo
     FROM perfil
     WHERE deleted_at IS NULL
     ORDER BY id_perfil`,
  );
  const [escopos] = await connection.query<SqlRow[]>(
    `SELECT id_perfil_recurso_escopo AS id, nome, status
     FROM perfil_recurso_escopo
     WHERE deleted_at IS NULL
     ORDER BY nome
     LIMIT 500`,
  );
  return {
    perfis: perfis.map((row) => ({
      id: Number(row.id),
      nome: String(row.nome),
      ativo: Number(row.ativo),
    })),
    escopos: escopos.map((row) => ({
      id: Number(row.id),
      nome: String(row.nome),
      status: Number(row.status),
    })),
  };
}

export async function listEscopos(connection: Connection, body: Record<string, unknown>) {
  const { page, pageSize, offset } = pageParams(body);
  const id = optionalId(body.id);
  const nome = optionalText(body.nome);
  const status = optionalId(body.status);
  const where = ["deleted_at IS NULL"];
  const params: Array<string | number> = [];
  if (id !== null) {
    where.push("id_perfil_recurso_escopo = ?");
    params.push(id);
  }
  if (nome) {
    where.push(`nome ${LIKE}`);
    params.push(likeContains(nome));
  }
  if (status !== null) {
    where.push("status = ?");
    params.push(status);
  }
  const clause = where.join(" AND ");
  const [countRows] = await connection.query<SqlRow[]>(
    `SELECT COUNT(*) AS total FROM perfil_recurso_escopo WHERE ${clause}`,
    params,
  );
  const [rows] = await connection.query<SqlRow[]>(
    `SELECT id_perfil_recurso_escopo AS id, nome, status
     FROM perfil_recurso_escopo
     WHERE ${clause}
     ORDER BY id_perfil_recurso_escopo DESC
     LIMIT ? OFFSET ?`,
    [...params, pageSize, offset],
  );
  const total = Number(countRows[0]?.total ?? 0);
  return {
    items: rows.map((row) => ({
      id: Number(row.id),
      nome: String(row.nome),
      status: Number(row.status),
    })),
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function listRotas(connection: Connection, body: Record<string, unknown>) {
  const { page, pageSize, offset } = pageParams(body);
  const id = optionalId(body.id);
  const path = optionalText(body.path);
  const observacao = optionalText(body.observacao);
  const method = optionalText(body.method).toUpperCase();
  const escopoId = optionalId(body.escopoId);
  const perfilId = optionalId(body.perfilId);
  const status = optionalId(body.status);
  const applicationId = optionalId(body.applicationId);
  const where = ["pr.deleted_at IS NULL"];
  const params: Array<string | number> = [];
  if (id !== null) {
    where.push("pr.id_perfil_recurso = ?");
    params.push(id);
  }
  if (path) {
    where.push(`pr.path ${LIKE}`);
    params.push(likeContains(path));
  }
  if (observacao) {
    where.push(`pr.observacao ${LIKE}`);
    params.push(likeContains(observacao));
  }
  if (method) {
    where.push("TRIM(pr.method) = ?");
    params.push(method);
  }
  if (escopoId !== null) {
    where.push("pr.id_perfil_recurso_escopo = ?");
    params.push(escopoId);
  }
  if (status !== null) {
    where.push("pr.status = ?");
    params.push(status);
  }
  if (applicationId !== null) {
    where.push("pr.application_id = ?");
    params.push(applicationId);
  }
  if (perfilId !== null) {
    where.push(
      `EXISTS (
        SELECT 1 FROM perfil_controle pc
        WHERE pc.id_perfil_recurso = pr.id_perfil_recurso
          AND pc.id_perfil = ?
          AND pc.deleted_at IS NULL
          AND pc.status = 1
      )`,
    );
    params.push(perfilId);
  }
  const clause = where.join(" AND ");
  const [countRows] = await connection.query<SqlRow[]>(
    `SELECT COUNT(*) AS total FROM perfil_recurso pr WHERE ${clause}`,
    params,
  );
  const [rows] = await connection.query<SqlRow[]>(
    `SELECT
       pr.id_perfil_recurso AS id,
       pr.observacao,
       pr.path,
       pr.method,
       pr.application_id AS applicationId,
       pr.id_perfil_recurso_escopo AS escopoId,
       e.nome AS escopoNome,
       pr.status,
       GROUP_CONCAT(DISTINCT CONCAT(p.id_perfil, ':', p.nome) ORDER BY p.id_perfil SEPARATOR '||') AS perfis
     FROM perfil_recurso pr
     JOIN perfil_recurso_escopo e
       ON e.id_perfil_recurso_escopo = pr.id_perfil_recurso_escopo
     LEFT JOIN perfil_controle pc
       ON pc.id_perfil_recurso = pr.id_perfil_recurso
      AND pc.deleted_at IS NULL
      AND pc.status = 1
     LEFT JOIN perfil p ON p.id_perfil = pc.id_perfil
     WHERE ${clause}
     GROUP BY pr.id_perfil_recurso, pr.observacao, pr.path, pr.method, pr.application_id,
              pr.id_perfil_recurso_escopo, e.nome, pr.status
     ORDER BY pr.id_perfil_recurso DESC
     LIMIT ? OFFSET ?`,
    [...params, pageSize, offset],
  );
  const total = Number(countRows[0]?.total ?? 0);
  return {
    items: rows.map((row) => ({
      id: Number(row.id),
      observacao: String(row.observacao),
      path: String(row.path),
      method: String(row.method),
      applicationId: Number(row.applicationId),
      escopoId: Number(row.escopoId),
      escopoNome: String(row.escopoNome),
      status: Number(row.status),
      perfis: parsePerfis(row.perfis == null ? null : String(row.perfis)),
    })),
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function testarRota(
  connection: Connection,
  method: string,
  path: string,
): Promise<Collision[]> {
  const [rows] = await connection.query<SqlRow[]>(
    `SELECT pr.id_perfil_recurso AS id, pr.path, pr.method, pr.observacao
     FROM perfil_recurso pr
     WHERE ? REGEXP CONCAT('^', pr.path)
       AND TRIM(pr.method) = ?
       AND pr.status = 1
       AND pr.deleted_at IS NULL
     ORDER BY pr.id_perfil_recurso DESC
     LIMIT 20`,
    [path, method],
  );
  return rows.map(mapCollision);
}

export interface ReleaseInput {
  method: string;
  storedPath: string;
  samplePath: string;
  observacao: string;
}

export async function liberarRotas(
  connection: Connection,
  input: {
    dryRun: boolean;
    profileIds: number[];
    scopeId: number;
    applicationId: number;
    routes: ReleaseInput[];
  },
): Promise<LiberarItemResult[]> {
  if (input.profileIds.length === 0) {
    throw new DbClientError("Selecione ao menos um perfil.", 400);
  }
  if (input.routes.length === 0) {
    throw new DbClientError("Informe ao menos uma rota.", 400);
  }
  if (input.routes.length > 40) {
    throw new DbClientError("Libere no máximo 40 rotas por vez.", 400);
  }
  await assertProfiles(connection, input.profileIds);
  await assertScope(connection, input.scopeId);
  if (![1, 2, 3, 4].includes(input.applicationId)) {
    throw new DbClientError("application_id precisa ser 1, 2, 3 ou 4.", 400);
  }

  const planned: LiberarItemResult[] = [];
  for (const route of input.routes) {
    assertRoute(route);
    const [existingRows] = await connection.query<SqlRow[]>(
      `SELECT id_perfil_recurso AS id
       FROM perfil_recurso
       WHERE path = ? AND method = ? AND deleted_at IS NULL
       LIMIT 1`,
      [route.storedPath, route.method],
    );
    const existingId = existingRows[0] ? Number(existingRows[0].id) : null;
    const collisions = (await testarRota(connection, route.method, route.samplePath)).filter(
      (collision) => collision.path !== route.storedPath,
    );
    planned.push({
      method: route.method,
      path: route.storedPath,
      observacao: route.observacao.slice(0, 100),
      action: existingId ? "vincular" : "criar",
      id: existingId,
      collisions,
    });
  }

  const seenInBatch = new Set<string>();
  for (const item of planned) {
    const key = `${item.method} ${item.path}`;
    if (seenInBatch.has(key)) {
      item.action = "vincular";
    }
    seenInBatch.add(key);
  }

  if (input.dryRun) return planned;

  await connection.beginTransaction();
  try {
    for (const item of planned) {
      const [existingRows] = await connection.query<SqlRow[]>(
        `SELECT id_perfil_recurso AS id
         FROM perfil_recurso
         WHERE path = ? AND method = ? AND deleted_at IS NULL
         LIMIT 1`,
        [item.path, item.method],
      );
      let resourceId = existingRows[0] ? Number(existingRows[0].id) : null;
      if (!resourceId) {
        const [created] = await connection.query<ResultSetHeader>(
          `INSERT INTO perfil_recurso
             (observacao, path, method, application_id, id_perfil_recurso_escopo, status, created_at, updated_at, deleted_at)
           VALUES (?, ?, ?, ?, ?, 1, NOW(), NOW(), NULL)`,
          [item.observacao, item.path, item.method, input.applicationId, input.scopeId],
        );
        resourceId = created.insertId;
        item.action = "criar";
      } else {
        item.action = "vincular";
      }
      item.id = resourceId;
      for (const profileId of input.profileIds) {
        await connection.query(
          `INSERT INTO perfil_controle
             (id_perfil, id_perfil_recurso, status, created_at, updated_at, deleted_at)
           VALUES (?, ?, 1, NOW(), NOW(), NULL)
           ON DUPLICATE KEY UPDATE status = 1, deleted_at = NULL, updated_at = NOW()`,
          [profileId, resourceId],
        );
      }
    }
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  }
  return planned;
}

async function assertProfiles(connection: Connection, profileIds: number[]): Promise<void> {
  const placeholders = profileIds.map(() => "?").join(", ");
  const [rows] = await connection.query<SqlRow[]>(
    `SELECT id_perfil AS id FROM perfil WHERE deleted_at IS NULL AND id_perfil IN (${placeholders})`,
    profileIds,
  );
  if (rows.length !== new Set(profileIds).size) {
    throw new DbClientError("Algum perfil selecionado não existe ou está removido.", 400);
  }
}

async function assertScope(connection: Connection, scopeId: number): Promise<void> {
  const [rows] = await connection.query<SqlRow[]>(
    `SELECT id_perfil_recurso_escopo AS id
     FROM perfil_recurso_escopo
     WHERE id_perfil_recurso_escopo = ? AND deleted_at IS NULL
     LIMIT 1`,
    [scopeId],
  );
  if (!rows[0]) {
    throw new DbClientError("Escopo não encontrado.", 400);
  }
}

function assertRoute(route: ReleaseInput): void {
  if (!["GET", "POST", "PUT", "PATCH", "DELETE"].includes(route.method)) {
    throw new DbClientError("Método inválido.", 400);
  }
  if (!route.storedPath.startsWith("/") || route.storedPath.length > 255) {
    throw new DbClientError("Path precisa começar com / e ter no máximo 255 caracteres.", 400);
  }
  if (route.storedPath.startsWith("^")) {
    throw new DbClientError("O path gravado não leva ^ — o middleware adiciona isso.", 400);
  }
  if (!route.observacao.trim()) {
    throw new DbClientError("Observação obrigatória.", 400);
  }
}

function parsePerfis(value: string | null): PerfilVinculo[] {
  if (!value) return [];
  return value.split("||").flatMap((part) => {
    const index = part.indexOf(":");
    if (index < 1) return [];
    return [{ id: Number(part.slice(0, index)), nome: part.slice(index + 1) }];
  });
}

function mapCollision(row: SqlRow): Collision {
  return {
    id: Number(row.id),
    path: String(row.path),
    method: String(row.method),
    observacao: String(row.observacao),
  };
}
