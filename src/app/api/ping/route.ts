import { ping } from "@/server/queries";
import { handleDbPost } from "@/server/http";

export async function POST(request: Request) {
  return handleDbPost(request, (connection) => ping(connection));
}
