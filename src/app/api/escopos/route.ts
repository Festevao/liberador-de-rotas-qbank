import { listEscopos } from "@/server/queries";
import { handleDbPost } from "@/server/http";

export async function POST(request: Request) {
  return handleDbPost(request, (connection, _config, body) => listEscopos(connection, body));
}
