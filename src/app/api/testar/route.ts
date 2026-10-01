import { normalizeRequestPath } from "@/lib/regex";
import { testarRota } from "@/server/queries";
import { DbClientError } from "@/server/db";
import { handleDbPost } from "@/server/http";

export async function POST(request: Request) {
  return handleDbPost(request, async (connection, _config, body) => {
    const method = typeof body.method === "string" ? body.method.trim().toUpperCase() : "";
    const path = typeof body.path === "string" ? normalizeRequestPath(body.path) : "";
    if (!["GET", "POST", "PUT", "PATCH", "DELETE"].includes(method) || !path.startsWith("/")) {
      throw new DbClientError("Informe método e um path que comece com /.", 400);
    }
    const matches = await testarRota(connection, method, path);
    return { method, path, matches };
  });
}
