import { describe, expect, it } from "vitest";

import { handleRequest } from "../src/index.ts";

interface McpResponseBody {
  result?: {
    isError?: boolean;
    structuredContent?: Record<string, unknown>;
  };
}

async function mcpTool(name: string, arguments_: Record<string, unknown>): Promise<McpResponseBody> {
  const response = await handleRequest(
    new Request("https://breeding.example/mcp", {
      method: "POST",
      headers: {
        Accept: "application/json, text/event-stream",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: { name, arguments: arguments_ },
      }),
    }),
    {},
  );

  expect(response.status).toBe(200);
  return response.json();
}

function identityName(value: unknown): string | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const identity = value as Record<string, unknown>;
  return typeof identity.name_en === "string" ? identity.name_en : undefined;
}

describe("current public MCP breeding reference", () => {
  it("reports the reviewed Palworld 1.0.3 Dedicated Server build", async () => {
    const body = await mcpTool("breeding_status", {});
    const structured = body.result?.structuredContent;
    const patchCheck = structured?.patch_check as Record<string, unknown> | undefined;

    expect(body.result?.isError).not.toBe(true);
    expect(structured?.validation_status).toBe("valid");
    expect(structured?.known_patch_check_status).toBe("current");
    expect(structured?.pal_count).toBe(299);
    expect(patchCheck).toMatchObject({
      status: "current",
      checked_game_version: "1.0.3",
      checked_game_build: "24575149",
      build_verified: true,
      requires_recheck_after_newer_patch: true,
    });
  });

  it("resolves the historic Snock/Jolthog regression through the MCP tool", async () => {
    const body = await mcpTool("breeding_pair", {
      parent_a: "Snock",
      parent_b: "Jolthog",
      gender_a: "FEMALE",
      gender_b: "MALE",
    });
    const structured = body.result?.structuredContent;
    const appliedTieBreaks = Array.isArray(structured?.applied_tie_breaks)
      ? structured.applied_tie_breaks
      : [];

    expect(body.result?.isError).not.toBe(true);
    expect(identityName(structured?.result_child)).toBe("Turtacle");
    expect(structured?.applied_rule).toBe("normal_formula");
    expect(appliedTieBreaks).toContain("equidistant_higher_combi_duplicate_priority");
  });
});
