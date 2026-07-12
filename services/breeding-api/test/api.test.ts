import { describe, expect, it } from "vitest";

import { authorizePath } from "../src/auth.ts";
import { handleRequest, type Env } from "../src/index.ts";

const token = "test-only-breeding-read-token-0123456789abcdef";
const env: Env = { BREEDING_READ_TOKEN: token };
const base = `https://breeding.example/${token}/v1`;

async function request(path: string, init?: RequestInit, runtimeEnv: Env = env): Promise<Response> {
  return handleRequest(new Request(`${base}${path}`, init), runtimeEnv);
}

interface PalIdentityBody {
  name_en: string;
}

interface ApiResponseBody {
  ok?: boolean;
  pal_count?: number;
  special_combination_count?: number;
  known_patch_check_status?: string;
  validation_status?: string;
  reference_age_days?: number | null;
  applied_rule?: string;
  resolution?: string;
  result_child?: PalIdentityBody;
  alternatives?: unknown[];
  total?: number;
  results?: Array<{
    parent_a?: PalIdentityBody;
    parent_b?: PalIdentityBody;
    child?: PalIdentityBody;
  }>;
  species_route_only?: boolean;
  found?: boolean;
  generation_count?: number | null;
  routes?: Array<{ steps: unknown[] }>;
  unresolved_conflicts?: unknown[];
  error?: {
    code: string;
    details?: { candidates?: unknown[] };
  };
  special_combination?: {
    parent_a_gender: string;
    parent_b_gender: string;
  };
}

async function body(response: Response): Promise<ApiResponseBody> {
  const value: unknown = await response.json();
  return value as ApiResponseBody;
}

describe("path authentication", () => {
  it("accepts only the exact first path token", async () => {
    await expect(authorizePath(`/${token}/v1/status`, token)).resolves.toMatchObject({
      endpoint: "status",
    });
    await expect(authorizePath("/wrong/v1/status", token)).resolves.toBeNull();
    await expect(authorizePath(`/${token}/v1/status`, undefined)).resolves.toBeNull();
  });

  it("returns an indistinguishable neutral 404 for missing, wrong, or unavailable secrets", async () => {
    const wrong = await handleRequest(
      new Request("https://breeding.example/wrong/v1/status", { method: "POST" }),
      env,
    );
    const missing = await handleRequest(new Request("https://breeding.example/v1/status"), env);
    const unavailable = await request("/status", undefined, {});
    expect([wrong.status, missing.status, unavailable.status]).toEqual([404, 404, 404]);
    expect(await wrong.text()).toBe(await missing.text());
    expect(await unavailable.text()).toBe('{"ok":false}');
  });
});

describe("worker HTTP surface", () => {
  it("returns status without claiming the patch is current", async () => {
    const response = await request("/status");
    const json = await body(response);
    expect(response.status).toBe(200);
    expect(json.pal_count).toBe(299);
    expect(json.special_combination_count).toBe(136);
    expect(json.known_patch_check_status).toBe("unknown");
    expect(json.validation_status).toBe("needs_review");
    expect(json.reference_age_days).toBeGreaterThanOrEqual(0);
  });

  it("supports HEAD, OPTIONS, ETag, and 304", async () => {
    const get = await request("/status");
    const etag = get.headers.get("ETag");
    expect(etag).toBeTruthy();

    const head = await request("/status", { method: "HEAD" });
    expect(head.status).toBe(200);
    expect(await head.text()).toBe("");
    expect(head.headers.get("X-Robots-Tag")).toContain("noindex");

    const notModified = await request("/status", { headers: { "If-None-Match": etag ?? "" } });
    expect(notModified.status).toBe(304);
    expect(await notModified.text()).toBe("");

    const options = await request("/status", { method: "OPTIONS" });
    expect(options.status).toBe(204);
    expect(options.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it("rejects write methods only after successful authentication", async () => {
    const response = await request("/status", { method: "POST" });
    expect(response.status).toBe(405);
    expect(response.headers.get("Allow")).toBe("GET, HEAD, OPTIONS");
    expect((await body(response)).error?.code).toBe("METHOD_NOT_ALLOWED");
  });

  it("returns structured ambiguity instead of guessing Gumoss", async () => {
    const response = await request("/pal?name=Gumoss");
    const json = await body(response);
    expect(response.status).toBe(409);
    expect(json.error?.code).toBe("AMBIGUOUS_PAL_NAME");
    expect(json.error?.details?.candidates).toHaveLength(2);
  });

  it.each([
    ["Elphidran", "Surfent", "Elphidran Aqua", "special_combination"],
    ["Anubis", "Eikthyrdeer Terra", "Kingpaca Cryst", "normal_formula"],
    ["Kingpaca Cryst", "Jolthog", "Elphidran", "normal_formula"],
    ["Anubis", "Anubis", "Anubis", "same_species"],
    ["Sibelyx", "Lamball", "Gobfin Ignis", "normal_formula"],
  ])("resolves %s + %s through /pair", async (parentA, parentB, child, rule) => {
    const response = await request(
      `/pair?parent_a=${encodeURIComponent(parentA)}&parent_b=${encodeURIComponent(parentB)}`,
    );
    const json = await body(response);
    expect(response.status).toBe(200);
    expect(json.result_child?.name_en).toBe(child);
    expect(json.applied_rule).toBe(rule);
  });

  it("requires gender disambiguation for Katress and Wixen", async () => {
    const unresolved = await request("/pair?parent_a=Katress&parent_b=Wixen");
    const unresolvedJson = await body(unresolved);
    expect(unresolvedJson.resolution).toBe("unresolved_gender");
    expect(unresolvedJson.alternatives).toHaveLength(2);

    const resolved = await request(
      "/pair?parent_a=Katress&parent_b=Wixen&gender_a=FEMALE&gender_b=MALE",
    );
    expect((await body(resolved)).result_child?.name_en).toBe("Katress Ignis");

    const reversed = await request(
      "/pair?parent_a=Wixen&parent_b=Katress&gender_a=MALE&gender_b=FEMALE",
    );
    const reversedJson = await body(reversed);
    expect(reversedJson.result_child?.name_en).toBe("Katress Ignis");
    expect(reversedJson.special_combination).toMatchObject({
      parent_a_gender: "MALE",
      parent_b_gender: "FEMALE",
    });
  });

  it("rejects explicit same-gender parents instead of exposing an index-inconsistent fallback", async () => {
    const response = await request(
      "/pair?parent_a=Katress&parent_b=Wixen&gender_a=MALE&gender_b=MALE",
    );
    expect(response.status).toBe(400);
    expect((await body(response)).error?.code).toBe("INCOMPATIBLE_GENDERS");
  });

  it("serves stable parent and child indexes with pagination", async () => {
    const parents = await request(
      "/parents?child=Elphidran%20Aqua&parent=Elphidran&special_only=true&max_results=10",
    );
    const parentJson = await body(parents);
    expect(parentJson.total).toBeGreaterThan(0);
    expect(
      parentJson.results?.some(
        (entry) =>
          entry.parent_a?.name_en === "Elphidran" && entry.parent_b?.name_en === "Surfent",
      ),
    ).toBe(true);

    const children = await request(
      "/children?parent=Anubis&second_parent=Eikthyrdeer%20Terra&max_results=10",
    );
    const childJson = await body(children);
    expect(childJson.results).toHaveLength(1);
    expect(childJson.results?.[0]?.child?.name_en).toBe("Kingpaca Cryst");
  });

  it("returns species-only shortest routes", async () => {
    const response = await request("/route?carrier=Anubis&target=Elphidran&max_generations=4");
    const json = await body(response);
    expect(response.status).toBe(200);
    expect(json.species_route_only).toBe(true);
    expect(json.found).toBe(true);
    expect(json.generation_count).toBeGreaterThan(0);
    expect(json.routes?.[0]?.steps).toHaveLength(json.generation_count ?? 0);
  });

  it("returns all equal one-generation witness mates when they fit under the cap", async () => {
    const response = await request(
      "/route?carrier=Anubis&target=Elizabee&max_generations=1&max_alternatives=25",
    );
    const json = await body(response);
    expect(json.generation_count).toBe(1);
    expect(json.routes).toHaveLength(11);
    expect(json.routes?.every(({ steps }) => steps.length === 1)).toBe(true);
  });

  it("exposes the precomputed validation block without secrets", async () => {
    const response = await request("/validate");
    const json = await body(response);
    expect(json.ok).toBe(false);
    expect(json.unresolved_conflicts).toHaveLength(2);
    expect(JSON.stringify(json)).not.toContain(token);
  });

  it("rejects duplicate singleton query parameters", async () => {
    const response = await request("/pal?name=Anubis&name=Lamball");
    expect(response.status).toBe(400);
    expect((await body(response)).error?.code).toBe("INVALID_PARAMETER");
  });
});
