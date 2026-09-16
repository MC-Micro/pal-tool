import { describe, expect, it } from "vitest";

import { handleRequest } from "../src/index.ts";

interface McpResponseBody {
  result?: {
    serverInfo?: { name?: string };
    tools?: Array<{
      name: string;
      securitySchemes?: Array<{ type: string }>;
      outputSchema?: Record<string, unknown>;
      annotations?: {
        readOnlyHint?: boolean;
        destructiveHint?: boolean;
        idempotentHint?: boolean;
        openWorldHint?: boolean;
      };
    }>;
    isError?: boolean;
    content?: Array<{ type?: string; text?: string }>;
    structuredContent?: Record<string, unknown>;
  };
}

async function mcp(method: string, params: Record<string, unknown>, id = 1): Promise<Response> {
  return handleRequest(
    new Request("https://breeding.example/mcp", {
      method: "POST",
      headers: {
        Accept: "application/json, text/event-stream",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
    }),
  );
}

async function mcpBody(response: Response): Promise<McpResponseBody> {
  return response.json();
}

function structured(body: McpResponseBody): Record<string, unknown> {
  return body.result?.structuredContent ?? {};
}

function identityName(value: unknown): string | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const identity = value as Record<string, unknown>;
  return typeof identity.name_en === "string" ? identity.name_en : undefined;
}

describe("public MCP endpoint", () => {
  it("initializes anonymously", async () => {
    const response = await mcp("initialize", {
      protocolVersion: "2025-11-25",
      capabilities: {},
      clientInfo: { name: "vitest", version: "1.0.0" },
    });
    const json = await mcpBody(response);
    expect(response.status).toBe(200);
    expect(json.result?.serverInfo?.name).toBe("palworld-breeding-api");
  });

  it("lists exactly five anonymous read-only tools with output schemas", async () => {
    const response = await mcp("tools/list", {});
    const listedTools = (await mcpBody(response)).result?.tools ?? [];
    expect(listedTools.map(({ name }) => name)).toEqual([
      "breeding_status",
      "breeding_pair",
      "breeding_parents",
      "breeding_children",
      "breeding_route",
    ]);
    expect(
      listedTools.every(
        ({ securitySchemes, outputSchema, annotations }) =>
          securitySchemes?.[0]?.type === "noauth" &&
          outputSchema?.type === "object" &&
          annotations?.readOnlyHint === true &&
          annotations.destructiveHint === false &&
          annotations.idempotentHint === true &&
          annotations.openWorldHint === false,
      ),
    ).toBe(true);
  });

  it("returns the validated breeding status and distinct canonical hashes", async () => {
    const response = await mcp("tools/call", { name: "breeding_status", arguments: {} });
    const result = structured(await mcpBody(response));
    expect(response.status).toBe(200);
    expect(result).toMatchObject({
      pal_count: 299,
      special_combination_count: 136,
      validation_status: "valid",
      known_patch_check_status: "current",
    });
    expect(result.source_data_hash).toMatch(/^[a-f0-9]{64}$/u);
    expect(result.generated_artifact_hash).toMatch(/^[a-f0-9]{64}$/u);
    expect(result.source_data_hash).not.toBe(result.generated_artifact_hash);
  });

  it.each([
    ["Elphidran", "Surfent", "Elphidran Aqua", "special_combination"],
    ["Anubis", "Eikthyrdeer Terra", "Bakemi", "normal_formula"],
    ["Kingpaca Cryst", "Jolthog", "Elphidran", "normal_formula"],
    ["Anubis", "Anubis", "Anubis", "same_species"],
    ["Sibelyx", "Lamball", "Surfent", "normal_formula"],
    ["Lamball", "Sibelyx", "Surfent", "normal_formula"],
    ["Lunaris", "Grintale", "Penking", "normal_formula"],
    ["Grintale", "Lunaris", "Penking", "normal_formula"],
  ])("resolves %s + %s through breeding_pair", async (parentA, parentB, child, rule) => {
    const response = await mcp("tools/call", {
      name: "breeding_pair",
      arguments: { parent_a: parentA, parent_b: parentB },
    });
    const result = structured(await mcpBody(response));
    expect(response.status).toBe(200);
    expect(identityName(result.result_child)).toBe(child);
    expect(result.applied_rule).toBe(rule);
  });

  it("preserves gender-aware pair resolution", async () => {
    const unresolved = structured(
      await mcpBody(
        await mcp("tools/call", {
          name: "breeding_pair",
          arguments: { parent_a: "Katress", parent_b: "Wixen" },
        }),
      ),
    );
    expect(unresolved.resolution).toBe("unresolved_gender");
    expect(unresolved.alternatives).toHaveLength(2);

    const resolved = structured(
      await mcpBody(
        await mcp("tools/call", {
          name: "breeding_pair",
          arguments: {
            parent_a: "Wixen",
            parent_b: "Katress",
            gender_a: "MALE",
            gender_b: "FEMALE",
          },
        }),
      ),
    );
    expect(identityName(resolved.result_child)).toBe("Katress Ignis");
    expect(resolved.special_combination).toMatchObject({
      parent_a_gender: "MALE",
      parent_b_gender: "FEMALE",
    });
  });

  it("returns stable parent and child index results", async () => {
    const parents = structured(
      await mcpBody(
        await mcp("tools/call", {
          name: "breeding_parents",
          arguments: {
            child: "Elphidran Aqua",
            parent: "Elphidran",
            special_only: true,
            max_results: 10,
          },
        }),
      ),
    );
    const parentResults = parents.results as Array<Record<string, unknown>>;
    expect(parents.total).toBeGreaterThan(0);
    expect(identityName(parents.child)).toBe("Elphidran Aqua");
    expect(
      parentResults.some(
        (entry) =>
          identityName(entry.parent_a) === "Elphidran" &&
          identityName(entry.parent_b) === "Surfent",
      ),
    ).toBe(true);

    const children = structured(
      await mcpBody(
        await mcp("tools/call", {
          name: "breeding_children",
          arguments: { parent: "Anubis", second_parent: "Eikthyrdeer Terra" },
        }),
      ),
    );
    const childResults = children.results as Array<Record<string, unknown>>;
    expect(childResults).toHaveLength(1);
    expect(identityName(childResults[0]?.child)).toBe("Bakemi");
  });

  it("returns a species-only shortest route with explicit limitations", async () => {
    const response = await mcp("tools/call", {
      name: "breeding_route",
      arguments: { carrier: "Anubis", target: "Elphidran", max_generations: 4 },
    });
    const result = structured(await mcpBody(response));
    expect(response.status).toBe(200);
    expect(result).toMatchObject({
      found: true,
      species_route_only: true,
      inventory_aware: false,
      passive_aware: false,
      iv_aware: false,
      unwanted_passives_aware: false,
      egg_cost_aware: false,
      cake_cost_aware: false,
      time_cost_aware: false,
      offspring_gender_feasibility_checked: false,
    });
    expect(result.generation_count).toBeGreaterThan(0);
  });

  it("returns structured tool errors without exposing another surface", async () => {
    const response = await mcp("tools/call", {
      name: "breeding_pair",
      arguments: { parent_a: "Definitely Not A Pal", parent_b: "Lamball" },
    });
    const result = (await mcpBody(response)).result;
    const error = result?.structuredContent?.error as Record<string, unknown> | undefined;
    expect(response.status).toBe(200);
    expect(result?.isError).toBe(true);
    expect(error?.code).toBe("PAL_NOT_FOUND");
    expect(result?.content?.[0]?.text).toContain("PAL_NOT_FOUND");
  });
});

describe("external worker surface", () => {
  it.each([
    ["/", "GET"],
    ["/v1/status", "GET"],
    ["/legacy-token/v1/status", "GET"],
    ["/legacy-token/v1/pair?parent_a=Anubis&parent_b=Lamball", "POST"],
    ["/mcp/", "POST"],
  ])("keeps %s neutral and non-public", async (path, method) => {
    const response = await handleRequest(
      new Request(`https://breeding.example${path}`, { method }),
    );
    expect(response.status).toBe(404);
    expect(await response.text()).toBe('{"ok":false}');
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("returns a bodyless neutral 404 for HEAD on non-MCP paths", async () => {
    const response = await handleRequest(
      new Request("https://breeding.example/legacy-token/v1/status", { method: "HEAD" }),
    );
    expect(response.status).toBe(404);
    expect(await response.text()).toBe("");
  });
});
