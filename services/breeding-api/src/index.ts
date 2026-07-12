import { authorizePath } from "./auth.ts";
import {
  ApiError,
  apiErrorResponse,
  jsonResponse,
  neutralNotFound,
  optionsResponse,
} from "./http.ts";
import { getReference } from "./reference.ts";
import { routeApiRequest } from "./routes.ts";

export interface Env {
  BREEDING_READ_TOKEN?: string;
}

export async function handleRequest(request: Request, env: Env): Promise<Response> {
  const head = request.method === "HEAD";
  const authorized = await authorizePath(new URL(request.url).pathname, env.BREEDING_READ_TOKEN);
  if (authorized === null) return neutralNotFound(head);

  if (request.method === "OPTIONS") return optionsResponse();
  if (request.method !== "GET" && request.method !== "HEAD") {
    const response = await apiErrorResponse(
      new ApiError(405, "METHOD_NOT_ALLOWED", "Only GET, HEAD, and OPTIONS are supported."),
      request,
      head,
    );
    response.headers.set("Allow", "GET, HEAD, OPTIONS");
    return response;
  }

  try {
    if (authorized.trailingSegments.length > 0) {
      throw new ApiError(404, "ENDPOINT_NOT_FOUND", "The requested API endpoint does not exist.");
    }
    return await routeApiRequest(authorized.endpoint, request, head);
  } catch (error: unknown) {
    if (error instanceof ApiError) return apiErrorResponse(error, request, head);
    return jsonResponse(
      {
        ok: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "The request could not be completed.",
          reference_id: getReference().dataHash,
        },
      },
      { status: 500, cacheControl: "no-store", request, head },
    );
  }
}

export default {
  fetch: handleRequest,
} satisfies ExportedHandler<Env>;
