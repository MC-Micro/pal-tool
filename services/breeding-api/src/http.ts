const encoder = new TextEncoder();

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export interface JsonResponseOptions {
  status?: number;
  cacheControl?: string;
  dataHash?: string;
  request?: Request;
  head?: boolean;
}

function securityHeaders(cacheControl: string): Headers {
  return new Headers({
    "Access-Control-Allow-Headers": "If-None-Match",
    "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
    "Access-Control-Allow-Origin": "*",
    "Cache-Control": cacheControl,
    "Content-Type": "application/json; charset=utf-8",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
    "X-Robots-Tag": "noindex, nofollow, noarchive",
  });
}

function hex(bytes: Uint8Array): string {
  let result = "";
  for (const byte of bytes) result += byte.toString(16).padStart(2, "0");
  return result;
}

async function responseEtag(body: string, dataHash: string): Promise<string> {
  const input = encoder.encode(`${dataHash}\u0000${body}`);
  const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", input));
  return `"${hex(hash)}"`;
}

function etagMatches(headerValue: string | null, etag: string): boolean {
  if (headerValue === null) return false;
  if (headerValue.trim() === "*") return true;
  return headerValue.split(",").some((candidate) => {
    const normalized = candidate.trim().replace(/^W\//, "");
    return normalized === etag;
  });
}

export async function jsonResponse(
  value: unknown,
  options: JsonResponseOptions = {},
): Promise<Response> {
  const status = options.status ?? 200;
  const cacheControl = options.cacheControl ?? "private, max-age=300, must-revalidate";
  const body = JSON.stringify(value);
  const headers = securityHeaders(cacheControl);

  if (options.dataHash !== undefined && status >= 200 && status < 300) {
    const etag = await responseEtag(body, options.dataHash);
    headers.set("ETag", etag);
    if (etagMatches(options.request?.headers.get("If-None-Match") ?? null, etag)) {
      headers.delete("Content-Type");
      return new Response(null, { status: 304, headers });
    }
  }

  return new Response(options.head ? null : body, { status, headers });
}

export function neutralNotFound(head = false): Response {
  const headers = securityHeaders("no-store");
  return new Response(head ? null : '{"ok":false}', { status: 404, headers });
}

export function optionsResponse(): Response {
  const headers = securityHeaders("no-store");
  headers.delete("Content-Type");
  return new Response(null, { status: 204, headers });
}

export async function apiErrorResponse(
  error: ApiError,
  request: Request,
  head: boolean,
): Promise<Response> {
  return jsonResponse(
    {
      ok: false,
      error: {
        code: error.code,
        message: error.message,
        ...(error.details === undefined ? {} : { details: error.details }),
      },
    },
    { status: error.status, cacheControl: "no-store", request, head },
  );
}

export function requiredSingleParameter(url: URL, name: string): string {
  const values = url.searchParams.getAll(name);
  if (values.length !== 1 || values[0] === undefined || values[0].trim().length === 0) {
    throw new ApiError(400, "INVALID_PARAMETER", `Query parameter ${name} is required exactly once.`);
  }
  const value = values[0].trim();
  if (value.length > 128) {
    throw new ApiError(400, "INVALID_PARAMETER", `Query parameter ${name} is too long.`);
  }
  return value;
}

export function optionalSingleParameter(url: URL, name: string): string | undefined {
  const values = url.searchParams.getAll(name);
  if (values.length === 0) return undefined;
  if (values.length !== 1 || values[0] === undefined) {
    throw new ApiError(400, "INVALID_PARAMETER", `Query parameter ${name} may appear at most once.`);
  }
  const value = values[0].trim();
  if (value.length === 0 || value.length > 128) {
    throw new ApiError(400, "INVALID_PARAMETER", `Query parameter ${name} is invalid.`);
  }
  return value;
}

export function integerParameter(
  url: URL,
  name: string,
  defaultValue: number,
  minimum: number,
  maximum: number,
): number {
  const raw = optionalSingleParameter(url, name);
  if (raw === undefined) return defaultValue;
  if (!/^\d+$/.test(raw)) {
    throw new ApiError(400, "INVALID_PARAMETER", `Query parameter ${name} must be an integer.`);
  }
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new ApiError(
      400,
      "INVALID_PARAMETER",
      `Query parameter ${name} must be between ${minimum} and ${maximum}.`,
    );
  }
  return value;
}

export function booleanParameter(
  url: URL,
  name: string,
  defaultValue: boolean | undefined = undefined,
): boolean | undefined {
  const raw = optionalSingleParameter(url, name);
  if (raw === undefined) return defaultValue;
  if (raw === "true") return true;
  if (raw === "false") return false;
  throw new ApiError(400, "INVALID_PARAMETER", `Query parameter ${name} must be true or false.`);
}
