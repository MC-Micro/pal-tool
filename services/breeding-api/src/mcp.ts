import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type CallToolResult,
  type Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

import { ApiError } from "./http.ts";
import { routeApiRequest } from "./routes.ts";

const NO_AUTH = [{ type: "noauth" }] as const;
const TOOL_ANNOTATIONS = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
} as const;

const genderSchema = z.enum(["ANY", "MALE", "FEMALE"]);
const emptySchema = z.object({}).strict();
const palIdentityOutputSchema = z
  .object({
    id: z.number().int(),
    internal_name: z.string(),
    name_de: z.string(),
    name_en: z.string(),
    variant: z.boolean(),
  })
  .passthrough();
const errorOutputSchema = z
  .object({
    ok: z.literal(false),
    error: z
      .object({
        code: z.string(),
        message: z.string(),
      })
      .passthrough(),
  })
  .passthrough();
const statusOutputSchema = z
  .object({
    ok: z.boolean(),
    validation_status: z.string(),
    pal_count: z.number().int(),
    special_combination_count: z.number().int(),
    source_data_hash: z.string(),
    generated_artifact_hash: z.string(),
  })
  .passthrough();
const pairOutputSchema = z
  .object({
    ok: z.literal(true),
    resolution: z.string(),
    normalized_parent_a: palIdentityOutputSchema,
    normalized_parent_b: palIdentityOutputSchema,
    result_child: palIdentityOutputSchema.nullable(),
    applied_rule: z.string(),
  })
  .passthrough();
const parentEntryOutputSchema = z
  .object({
    parent_a: palIdentityOutputSchema,
    parent_b: palIdentityOutputSchema,
    parent_a_gender: genderSchema,
    parent_b_gender: genderSchema,
    rule: z.string(),
    special_combination_row_id: z.string().nullable(),
  })
  .passthrough();
const parentsOutputSchema = z
  .object({
    ok: z.literal(true),
    child: palIdentityOutputSchema,
    total: z.number().int(),
    offset: z.number().int(),
    limit: z.number().int(),
    next_offset: z.number().int().nullable(),
    results: z.array(parentEntryOutputSchema),
    reference_id: z.string(),
  })
  .passthrough();
const childEntryOutputSchema = z
  .object({
    parent: palIdentityOutputSchema,
    parent_gender: genderSchema,
    second_parent: palIdentityOutputSchema,
    second_parent_gender: genderSchema,
    child: palIdentityOutputSchema,
    rule: z.string(),
    special_combination_row_id: z.string().nullable(),
  })
  .passthrough();
const childrenOutputSchema = z
  .object({
    ok: z.literal(true),
    parent: palIdentityOutputSchema,
    total: z.number().int(),
    offset: z.number().int(),
    limit: z.number().int(),
    next_offset: z.number().int().nullable(),
    results: z.array(childEntryOutputSchema),
    reference_id: z.string(),
  })
  .passthrough();
const routeOutputSchema = z
  .object({
    ok: z.literal(true),
    found: z.boolean(),
    species_route_only: z.literal(true),
    inventory_aware: z.literal(false),
    passive_aware: z.literal(false),
    iv_aware: z.literal(false),
    unwanted_passives_aware: z.literal(false),
    egg_cost_aware: z.literal(false),
    cake_cost_aware: z.literal(false),
    time_cost_aware: z.literal(false),
    offspring_gender_feasibility_checked: z.literal(false),
    carrier: palIdentityOutputSchema,
    target: palIdentityOutputSchema,
    generation_count: z.number().int().nullable(),
    routes: z.array(
      z
        .object({
          generation_count: z.number().int(),
          steps: z.array(z.object({}).passthrough()),
        })
        .passthrough(),
    ),
  })
  .passthrough();
const pairSchema = z
  .object({
    parent_a: z.string().min(1).max(128),
    parent_b: z.string().min(1).max(128),
    gender_a: genderSchema.optional(),
    gender_b: genderSchema.optional(),
  })
  .strict();
const parentsSchema = z
  .object({
    child: z.string().min(1).max(128),
    parent: z.string().min(1).max(128).optional(),
    gender: genderSchema.optional(),
    special_only: z.boolean().optional(),
    offset: z.number().int().min(0).max(1_000_000).optional(),
    max_results: z.number().int().min(1).max(100).optional(),
  })
  .strict();
const childrenSchema = z
  .object({
    parent: z.string().min(1).max(128),
    second_parent: z.string().min(1).max(128).optional(),
    child: z.string().min(1).max(128).optional(),
    offset: z.number().int().min(0).max(1_000_000).optional(),
    max_results: z.number().int().min(1).max(100).optional(),
  })
  .strict();
const routeSchema = z
  .object({
    carrier: z.string().min(1).max(128),
    target: z.string().min(1).max(128),
    max_generations: z.number().int().min(0).max(8).optional(),
    max_alternatives: z.number().int().min(1).max(25).optional(),
  })
  .strict();

type ToolSchema = z.ZodObject<z.ZodRawShape>;

interface PublicTool extends Tool {
  securitySchemes: typeof NO_AUTH;
  outputSchema: NonNullable<Tool["outputSchema"]>;
}

interface ToolDefinition {
  descriptor: PublicTool;
  schema: ToolSchema;
  endpoint: "status" | "pair" | "parents" | "children" | "route";
}

function inputSchema(schema: ToolSchema): Tool["inputSchema"] {
  return z.toJSONSchema(schema) as Tool["inputSchema"];
}

function outputSchema(schema: ToolSchema): NonNullable<Tool["outputSchema"]> {
  return {
    type: "object",
    anyOf: [z.toJSONSchema(schema), z.toJSONSchema(errorOutputSchema)],
  };
}

function tool(
  name: string,
  description: string,
  schema: ToolSchema,
  resultSchema: ToolSchema,
  endpoint: ToolDefinition["endpoint"],
): ToolDefinition {
  return {
    endpoint,
    schema,
    descriptor: {
      name,
      description,
      inputSchema: inputSchema(schema),
      outputSchema: outputSchema(resultSchema),
      annotations: TOOL_ANNOTATIONS,
      securitySchemes: NO_AUTH,
      _meta: { securitySchemes: NO_AUTH },
    },
  };
}

const tools = [
  tool(
    "breeding_status",
    "Returns the current validation and version status of the read-only Palworld breeding reference.",
    emptySchema,
    statusOutputSchema,
    "status",
  ),
  tool(
    "breeding_pair",
    "Resolves the child species for two Pal parents, including special combinations and gender rules.",
    pairSchema,
    pairOutputSchema,
    "pair",
  ),
  tool(
    "breeding_parents",
    "Lists parent combinations that produce a requested Pal species.",
    parentsSchema,
    parentsOutputSchema,
    "parents",
  ),
  tool(
    "breeding_children",
    "Lists possible child species for a Pal and optional second-parent or child filters.",
    childrenSchema,
    childrenOutputSchema,
    "children",
  ),
  tool(
    "breeding_route",
    "Finds a species-only breeding route. It is not passive-aware, IV-aware, inventory-aware, cost-optimized, or time-optimized.",
    routeSchema,
    routeOutputSchema,
    "route",
  ),
] as const;

const toolsByName = new Map(tools.map((definition) => [definition.descriptor.name, definition]));

function queryFor(arguments_: Record<string, unknown>): string {
  const query = new URLSearchParams();
  for (const [name, value] of Object.entries(arguments_)) {
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      query.set(name, String(value));
    }
  }
  return query.toString();
}

function identityName(value: unknown): string | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const identity = value as Record<string, unknown>;
  return typeof identity.name_en === "string" ? identity.name_en : undefined;
}

function stringField(value: unknown, fallback: string): string {
  return typeof value === "string" ? value : fallback;
}

function numberField(value: unknown, fallback: string): string {
  return typeof value === "number" && Number.isFinite(value) ? String(value) : fallback;
}

function shortText(endpoint: ToolDefinition["endpoint"], body: Record<string, unknown>): string {
  if (endpoint === "status") {
    return `Breeding reference: ${stringField(body.validation_status, "unknown")} (${numberField(body.pal_count, "?")} Pals).`;
  }
  if (endpoint === "pair") {
    const child = identityName(body.result_child) ?? "unresolved";
    return `${identityName(body.normalized_parent_a) ?? "Parent A"} + ${identityName(body.normalized_parent_b) ?? "Parent B"} -> ${child}.`;
  }
  if (endpoint === "parents") {
    return `Found ${numberField(body.total, "0")} parent combinations for ${identityName(body.child) ?? "the requested Pal"}.`;
  }
  if (endpoint === "children") {
    return `Found ${numberField(body.total, "0")} child results for ${identityName(body.parent) ?? "the requested parent"}.`;
  }
  const generations = body.generation_count;
  return body.found === true
    ? `Shortest species route uses ${numberField(generations, "?")} generation(s).`
    : "No species route was found within the requested generation limit.";
}

function errorResult(code: string, message: string, details?: unknown): CallToolResult {
  const structuredContent = {
    ok: false,
    error: {
      code,
      message,
      ...(details === undefined ? {} : { details }),
    },
  };
  return {
    isError: true,
    content: [{ type: "text", text: `${code}: ${message}` }],
    structuredContent,
  };
}

async function invokeTool(definition: ToolDefinition, rawArguments: unknown): Promise<CallToolResult> {
  const parsed = definition.schema.safeParse(rawArguments ?? {});
  if (!parsed.success) {
    return errorResult(
      "INVALID_TOOL_ARGUMENTS",
      "The tool arguments are invalid.",
      parsed.error.issues.map(({ path, message }) => ({ path: path.join("."), message })),
    );
  }

  const url = new URL(`https://mcp.internal/v1/${definition.endpoint}`);
  const query = queryFor(parsed.data);
  if (query.length > 0) url.search = query;

  try {
    const response = await routeApiRequest(
      definition.endpoint,
      new Request(url, { method: "GET" }),
      false,
    );
    const body: Record<string, unknown> = await response.json();
    return {
      content: [{ type: "text", text: shortText(definition.endpoint, body) }],
      structuredContent: body,
    };
  } catch (error: unknown) {
    if (error instanceof ApiError) return errorResult(error.code, error.message, error.details);
    return errorResult("INTERNAL_ERROR", "The breeding query could not be completed.");
  }
}

function createMcpServer(): Server {
  const server = new Server(
    { name: "palworld-breeding-api", version: "1.0.0" },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, () => ({
    tools: tools.map(({ descriptor }) => descriptor),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const definition = toolsByName.get(request.params.name);
    if (definition === undefined) {
      return errorResult("UNKNOWN_TOOL", "The requested breeding tool does not exist.");
    }
    return invokeTool(definition, request.params.arguments);
  });

  return server;
}

export async function handleMcpRequest(request: Request): Promise<Response> {
  const server = createMcpServer();
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  await server.connect(transport);
  return transport.handleRequest(request);
}
