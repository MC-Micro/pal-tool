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
  openWorldHint: false,
} as const;

const genderSchema = z.enum(["ANY", "MALE", "FEMALE"]);
const emptySchema = z.object({}).strict();
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
type ToolArguments = Record<string, string | number | boolean | undefined>;

interface PublicTool extends Tool {
  securitySchemes: typeof NO_AUTH;
}

interface ToolDefinition {
  descriptor: PublicTool;
  schema: ToolSchema;
  endpoint: "status" | "pair" | "parents" | "children" | "route";
}

function inputSchema(schema: ToolSchema): Tool["inputSchema"] {
  return z.toJSONSchema(schema) as Tool["inputSchema"];
}

function tool(
  name: string,
  description: string,
  schema: ToolSchema,
  endpoint: ToolDefinition["endpoint"],
): ToolDefinition {
  return {
    endpoint,
    schema,
    descriptor: {
      name,
      description,
      inputSchema: inputSchema(schema),
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
    "status",
  ),
  tool(
    "breeding_pair",
    "Resolves the child species for two Pal parents, including special combinations and gender rules.",
    pairSchema,
    "pair",
  ),
  tool(
    "breeding_parents",
    "Lists parent combinations that produce a requested Pal species.",
    parentsSchema,
    "parents",
  ),
  tool(
    "breeding_children",
    "Lists possible child species for a Pal and optional second-parent or child filters.",
    childrenSchema,
    "children",
  ),
  tool(
    "breeding_route",
    "Finds a species-only breeding route. It is not passive-aware, IV-aware, inventory-aware, cost-optimized, or time-optimized.",
    routeSchema,
    "route",
  ),
] as const;

const toolsByName = new Map(tools.map((definition) => [definition.descriptor.name, definition]));

function queryFor(arguments_: ToolArguments): string {
  const query = new URLSearchParams();
  for (const [name, value] of Object.entries(arguments_)) {
    if (value !== undefined) query.set(name, String(value));
  }
  return query.toString();
}

function identityName(value: unknown): string | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const identity = value as Record<string, unknown>;
  return typeof identity.name_en === "string" ? identity.name_en : undefined;
}

function shortText(endpoint: ToolDefinition["endpoint"], body: Record<string, unknown>): string {
  if (endpoint === "status") {
    return `Breeding reference: ${String(body.validation_status ?? "unknown")} (${String(body.pal_count ?? "?")} Pals).`;
  }
  if (endpoint === "pair") {
    const child = identityName(body.result_child) ?? "unresolved";
    return `${identityName(body.normalized_parent_a) ?? "Parent A"} + ${identityName(body.normalized_parent_b) ?? "Parent B"} -> ${child}.`;
  }
  if (endpoint === "parents") {
    return `Found ${String(body.total ?? 0)} parent combinations for ${identityName(body.child) ?? "the requested Pal"}.`;
  }
  if (endpoint === "children") {
    return `Found ${String(body.total ?? 0)} child results for ${identityName(body.parent) ?? "the requested parent"}.`;
  }
  const generations = body.generation_count;
  return body.found === true
    ? `Shortest species route uses ${String(generations)} generation(s).`
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
  const query = queryFor(parsed.data as ToolArguments);
  if (query.length > 0) url.search = query;

  try {
    const response = await routeApiRequest(
      definition.endpoint,
      new Request(url, { method: "GET" }),
      false,
    );
    const body = (await response.json()) as Record<string, unknown>;
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
