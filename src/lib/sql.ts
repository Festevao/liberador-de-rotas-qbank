export function likeContains(value: string): string {
  return `%${value.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
}

export function sqlString(value: string): string {
  return `'${value.replace(/\\/g, "\\\\").replace(/'/g, "''")}'`;
}

export interface SqlRoute {
  method: string;
  storedPath: string;
  observacao: string;
}

export function copyInsertSql(
  routes: SqlRoute[],
  profileIds: number[],
  scopeId: number,
  applicationId: number,
): string {
  const profileUnion = profileIds
    .map((id, index) =>
      index === 0 ? `SELECT ${id} AS id_perfil` : `UNION ALL SELECT ${id}`,
    )
    .join("\n  ");

  return routes
    .map((route) => {
      const path = sqlString(route.storedPath);
      const method = sqlString(route.method);
      const observacao = sqlString(route.observacao.slice(0, 100));
      return `INSERT INTO perfil_recurso (observacao, path, method, application_id, id_perfil_recurso_escopo, status, created_at, updated_at)
SELECT ${observacao}, ${path}, ${method}, ${applicationId}, ${scopeId}, 1, NOW(), NOW()
FROM DUAL
WHERE NOT EXISTS (
  SELECT 1 FROM perfil_recurso
  WHERE path = ${path} AND method = ${method} AND deleted_at IS NULL
);

INSERT INTO perfil_controle (id_perfil, id_perfil_recurso, status, created_at, updated_at)
SELECT ids.id_perfil, pr.id_perfil_recurso, 1, NOW(), NOW()
FROM perfil_recurso pr
JOIN (
  ${profileUnion}
) ids
WHERE pr.path = ${path} AND pr.method = ${method} AND pr.deleted_at IS NULL
ON DUPLICATE KEY UPDATE status = 1, deleted_at = NULL, updated_at = NOW();`;
    })
    .join("\n\n");
}

export function copyKnexMigration(
  routes: SqlRoute[],
  profileIds: number[],
  scopeId: number,
  applicationId: number,
): string {
  const resources = routes.map((route) => ({
    observacao: route.observacao.slice(0, 100),
    path: route.storedPath,
    method: route.method,
    application_id: applicationId,
    id_perfil_recurso_escopo: scopeId,
    status: 1,
  }));

  return `import type { Knex } from "knex";

const RESOURCES = ${JSON.stringify(resources, null, "\t")};

const PROFILE_IDS = ${JSON.stringify(profileIds)};

export async function up(knex: Knex): Promise<void> {
	for (const resource of RESOURCES) {
		const [id] = await knex("perfil_recurso").insert(resource);
		await knex("perfil_controle")
			.insert(
				PROFILE_IDS.map((id_perfil: number) => ({
					id_perfil,
					id_perfil_recurso: id,
					status: 1,
				})),
			)
			.onConflict(["id_perfil", "id_perfil_recurso"])
			.merge();
	}
}
`;
}
