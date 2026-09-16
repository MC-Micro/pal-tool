import { neutralNotFound } from "./http.ts";
import { handleMcpRequest } from "./mcp.ts";

export async function handleRequest(request: Request): Promise<Response> {
  if (new URL(request.url).pathname === "/mcp") return handleMcpRequest(request);
  return neutralNotFound(request.method === "HEAD");
}

export default {
  fetch: handleRequest,
} satisfies ExportedHandler;
