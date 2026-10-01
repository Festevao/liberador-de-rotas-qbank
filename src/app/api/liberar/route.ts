import { liberarRotas, type ReleaseInput } from "@/server/queries";
import { DbClientError } from "@/server/db";
import { handleDbPost } from "@/server/http";

export async function POST(request: Request) {
  return handleDbPost(request, async (connection, config, body) => {
    const profileIds = numberList(body.profileIds);
    const scopeId = Number(body.scopeId);
    const applicationId = Number(body.applicationId);
    const routes = parseRoutes(body.routes);
    if (!Number.isInteger(scopeId)) {
      throw new DbClientError("Escolha um escopo.", 400);
    }
    const items = await liberarRotas(connection, {
      dryRun: body.dryRun !== false,
      profileIds,
      scopeId,
      applicationId,
      routes,
    });
    return {
      dryRun: body.dryRun !== false,
      host: config.host,
      database: config.database,
      items,
    };
  });
}

function numberList(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => Number(item))
    .filter((item) => Number.isInteger(item) && item > 0);
}

function parseRoutes(value: unknown): ReleaseInput[] {
  if (!Array.isArray(value)) {
    throw new DbClientError("Lista de rotas inválida.", 400);
  }
  return value.map((item) => {
    if (!item || typeof item !== "object") {
      throw new DbClientError("Rota inválida.", 400);
    }
    const route = item as Record<string, unknown>;
    return {
      method: typeof route.method === "string" ? route.method.trim().toUpperCase() : "",
      storedPath: typeof route.storedPath === "string" ? route.storedPath : "",
      samplePath: typeof route.samplePath === "string" ? route.samplePath : "",
      observacao: typeof route.observacao === "string" ? route.observacao.trim() : "",
    };
  });
}
