import {
  verifiedIdentityFromVerifier,
  type AuthEvidence,
  type AuthVerifier,
  type VerifiedExternalIdentity,
} from "./contracts.ts";

interface AccessJwtHeader {
  alg: "RS256";
  kid: string;
}

interface AccessJwtClaims {
  iss: string;
  sub: string;
  aud: string | string[];
  exp: number;
  nbf?: number;
  email?: string;
}

export interface JwksResolver {
  resolve(kid: string, signal: AbortSignal): Promise<JsonWebKey>;
}

export interface CloudflareAccessVerifierOptions {
  issuer: string;
  audience: string;
  jwks: JwksResolver;
  clockSkewSeconds?: number;
  nowEpochSeconds?: () => number;
}

export class InvalidAccessAssertionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidAccessAssertionError";
  }
}

/**
 * Locally testable verification boundary for a Cloudflare Access application
 * token. Fetching and caching the live Access JWKS remains an external adapter.
 */
export class CloudflareAccessJwtVerifier implements AuthVerifier {
  readonly #issuer: string;
  readonly #audience: string;
  readonly #jwks: JwksResolver;
  readonly #clockSkewSeconds: number;
  readonly #nowEpochSeconds: () => number;

  constructor(options: CloudflareAccessVerifierOptions) {
    this.#issuer = requireConfiguration(options.issuer, "issuer");
    this.#audience = requireConfiguration(options.audience, "audience");
    this.#jwks = options.jwks;
    this.#clockSkewSeconds = options.clockSkewSeconds ?? 30;
    this.#nowEpochSeconds =
      options.nowEpochSeconds ?? (() => Math.floor(Date.now() / 1_000));
    if (
      !Number.isSafeInteger(this.#clockSkewSeconds) ||
      this.#clockSkewSeconds < 0
    ) {
      throw new Error("clockSkewSeconds must be a non-negative safe integer.");
    }
  }

  async verify(
    evidence: AuthEvidence,
    signal: AbortSignal,
  ): Promise<VerifiedExternalIdentity> {
    const parts = evidence.assertion.split(".");
    if (parts.length !== 3) {
      throw new InvalidAccessAssertionError("Access assertion is not a JWT.");
    }
    const [encodedHeader, encodedClaims, encodedSignature] = parts;
    if (
      encodedHeader === undefined ||
      encodedClaims === undefined ||
      encodedSignature === undefined
    ) {
      throw new InvalidAccessAssertionError("Access assertion is incomplete.");
    }

    const header = parseHeader(encodedHeader);
    const claims = parseClaims(encodedClaims);

    const jwk = await this.#jwks.resolve(header.kid, signal);
    if (signal.aborted) {
      throw new InvalidAccessAssertionError("Access verification was aborted.");
    }
    const publicKey = await crypto.subtle.importKey(
      "jwk",
      jwk,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["verify"],
    );
    const signedBytes = new TextEncoder().encode(
      encodedHeader + "." + encodedClaims,
    );
    const signature = decodeBase64Url(encodedSignature);
    const valid = await crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5",
      publicKey,
      toArrayBuffer(signature),
      toArrayBuffer(signedBytes),
    );
    if (!valid) {
      throw new InvalidAccessAssertionError(
        "Access assertion signature is invalid.",
      );
    }
    validateClaims(
      claims,
      this.#issuer,
      this.#audience,
      this.#nowEpochSeconds(),
      this.#clockSkewSeconds,
    );

    return verifiedIdentityFromVerifier({
      provider: "cloudflare-access",
      issuer: claims.iss,
      subject: claims.sub,
      ...(claims.email === undefined ? {} : { email: claims.email }),
    });
  }
}

function parseHeader(encoded: string): AccessJwtHeader {
  const value = parseJsonObject(encoded, "header");
  if (value.alg !== "RS256" || typeof value.kid !== "string" || value.kid === "") {
    throw new InvalidAccessAssertionError(
      "Access assertion requires an RS256 algorithm and key id.",
    );
  }
  return { alg: value.alg, kid: value.kid };
}

function parseClaims(encoded: string): AccessJwtClaims {
  const value = parseJsonObject(encoded, "claims");
  if (
    typeof value.iss !== "string" ||
    typeof value.sub !== "string" ||
    (typeof value.aud !== "string" &&
      !(
        Array.isArray(value.aud) &&
        value.aud.every((entry) => typeof entry === "string")
      )) ||
    typeof value.exp !== "number" ||
    (value.nbf !== undefined && typeof value.nbf !== "number") ||
    (value.email !== undefined && typeof value.email !== "string")
  ) {
    throw new InvalidAccessAssertionError(
      "Access assertion claims have an invalid shape.",
    );
  }
  return {
    iss: value.iss,
    sub: value.sub,
    aud: value.aud,
    exp: value.exp,
    ...(value.nbf === undefined ? {} : { nbf: value.nbf }),
    ...(value.email === undefined ? {} : { email: value.email }),
  };
}

function validateClaims(
  claims: AccessJwtClaims,
  issuer: string,
  audience: string,
  now: number,
  clockSkewSeconds: number,
): void {
  if (claims.iss !== issuer) {
    throw new InvalidAccessAssertionError("Access assertion issuer is invalid.");
  }
  const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (!audiences.includes(audience)) {
    throw new InvalidAccessAssertionError("Access assertion audience is invalid.");
  }
  if (claims.sub.trim() === "") {
    throw new InvalidAccessAssertionError("Access assertion subject is empty.");
  }
  if (!Number.isSafeInteger(claims.exp) || claims.exp <= now - clockSkewSeconds) {
    throw new InvalidAccessAssertionError("Access assertion is expired.");
  }
  if (
    claims.nbf !== undefined &&
    (!Number.isSafeInteger(claims.nbf) || claims.nbf > now + clockSkewSeconds)
  ) {
    throw new InvalidAccessAssertionError("Access assertion is not active yet.");
  }
}

function parseJsonObject(
  encoded: string,
  section: string,
): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(
      new TextDecoder().decode(decodeBase64Url(encoded)),
    );
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      throw new Error("not an object");
    }
    return parsed as Record<string, unknown>;
  } catch (error) {
    const reason = error instanceof Error ? error.message : "unknown error";
    throw new InvalidAccessAssertionError(
      "Access assertion " + section + " is not valid JSON: " + reason,
    );
  }
}

function decodeBase64Url(value: string): Uint8Array {
  try {
    const base64 = value.replaceAll("-", "+").replaceAll("_", "/");
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
    const binary = atob(padded);
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  } catch {
    throw new InvalidAccessAssertionError(
      "Access assertion contains invalid base64url.",
    );
  }
}

function toArrayBuffer(value: Uint8Array): ArrayBuffer {
  const result = new ArrayBuffer(value.byteLength);
  new Uint8Array(result).set(value);
  return result;
}

function requireConfiguration(value: string, name: string): string {
  const trimmed = value.trim();
  if (trimmed === "") {
    throw new Error("Cloudflare Access " + name + " must not be empty.");
  }
  return trimmed;
}
