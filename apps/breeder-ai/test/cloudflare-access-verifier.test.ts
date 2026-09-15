import { describe, expect, it } from "vitest";

import { verifyExternalIdentity } from "../src/auth/contracts.ts";
import {
  CloudflareAccessJwtVerifier,
  InvalidAccessAssertionError,
  type JwksResolver,
} from "../src/auth/cloudflare-access-verifier.ts";

const ISSUER = "https://phase0.cloudflareaccess.test";
const AUDIENCE = "phase0-audience";
const NOW = 1_789_419_600;

describe("Cloudflare Access JWT verification boundary", () => {
  it("verifies signature and qualified identity claims server-side", async () => {
    const fixture = await jwtFixture();
    const verifier = new CloudflareAccessJwtVerifier({
      issuer: ISSUER,
      audience: AUDIENCE,
      jwks: fixture.jwks,
      nowEpochSeconds: () => NOW,
    });

    const identity = await verifyExternalIdentity(
      verifier,
      { assertion: fixture.token },
      new AbortController().signal,
    );

    expect(identity).toMatchObject({
      provider: "cloudflare-access",
      issuer: ISSUER,
      subject: "access-user-subject",
      email: "person@example.test",
    });
  });

  it("rejects a tampered signature, wrong audience, and expired assertion", async () => {
    const fixture = await jwtFixture();
    const verifier = new CloudflareAccessJwtVerifier({
      issuer: ISSUER,
      audience: AUDIENCE,
      jwks: fixture.jwks,
      nowEpochSeconds: () => NOW,
      clockSkewSeconds: 0,
    });
    const tampered = tamperSignature(fixture.token);

    await expect(
      verifier.verify(
        { assertion: tampered },
        new AbortController().signal,
      ),
    ).rejects.toBeInstanceOf(InvalidAccessAssertionError);
    await expect(
      verifier.verify(
        { assertion: await fixture.sign({ aud: "other-audience" }) },
        new AbortController().signal,
      ),
    ).rejects.toMatchObject({ message: "Access assertion audience is invalid." });
    await expect(
      verifier.verify(
        { assertion: await fixture.sign({ exp: NOW - 1 }) },
        new AbortController().signal,
      ),
    ).rejects.toMatchObject({ message: "Access assertion is expired." });
  });

  it("rejects a validly signed non-application Access token", async () => {
    const fixture = await jwtFixture();
    const verifier = new CloudflareAccessJwtVerifier({
      issuer: ISSUER,
      audience: AUDIENCE,
      jwks: fixture.jwks,
      nowEpochSeconds: () => NOW,
    });

    await expect(
      verifyExternalIdentity(
        verifier,
        { assertion: await fixture.sign({ type: "org" }) },
        new AbortController().signal,
      ),
    ).rejects.toMatchObject({
      message: "Access assertion is not an application token.",
    });
  });
});

async function jwtFixture(): Promise<{
  token: string;
  jwks: JwksResolver;
  sign: (
    overrides?: Partial<{
      aud: string;
      exp: number;
      type: string;
    }>,
  ) => Promise<string>;
}> {
  const keys = await crypto.subtle.generateKey(
    {
      name: "RSASSA-PKCS1-v1_5",
      modulusLength: 2_048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["sign", "verify"],
  );
  const publicJwk = await crypto.subtle.exportKey("jwk", keys.publicKey);
  const sign = async (
    overrides: Partial<{ aud: string; exp: number; type: string }> = {},
  ): Promise<string> => {
    const header = encodeJson({ alg: "RS256", kid: "phase0-key" });
    const claims = encodeJson({
      type: overrides.type ?? "app",
      iss: ISSUER,
      sub: "access-user-subject",
      aud: overrides.aud ?? AUDIENCE,
      exp: overrides.exp ?? NOW + 300,
      nbf: NOW - 30,
      email: "person@example.test",
    });
    const input = header + "." + claims;
    const signature = await crypto.subtle.sign(
      "RSASSA-PKCS1-v1_5",
      keys.privateKey,
      new TextEncoder().encode(input),
    );
    return input + "." + encodeBytes(new Uint8Array(signature));
  };

  return {
    token: await sign(),
    sign,
    jwks: {
      resolve(kid): Promise<JsonWebKey> {
        return kid === "phase0-key"
          ? Promise.resolve(publicJwk)
          : Promise.reject(new Error("Unknown test key."));
      },
    },
  };
}

function encodeJson(value: unknown): string {
  return encodeBytes(new TextEncoder().encode(JSON.stringify(value)));
}

function encodeBytes(value: Uint8Array): string {
  let binary = "";
  for (const byte of value) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/u, "");
}

function tamperSignature(token: string): string {
  const parts = token.split(".");
  const signature = parts[2];
  if (parts.length !== 3 || signature === undefined || signature === "") {
    throw new Error("Invalid JWT test fixture.");
  }
  parts[2] = (signature.startsWith("a") ? "b" : "a") + signature.slice(1);
  return parts.join(".");
}
