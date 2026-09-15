import { z } from "zod";

export const EntityMentionSchema = z
  .object({
    kind: z.enum(["species", "passive"]),
    text: z.string().min(1).max(200),
  })
  .strict();

export const ProposedActionSchema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("ADD_BULK_COPIES"),
      speciesMention: z.string().min(1).max(200),
      amount: z.number().int().positive(),
    })
    .strict(),
  z
    .object({
      type: z.literal("SET_NOTE"),
      key: z.string().min(1).max(100),
      value: z.string().max(1_000),
    })
    .strict(),
]);

export const ReasoningOutputSchema = z
  .object({
    intent: z.enum([
      "INVENTORY_MUTATION",
      "HYPOTHETICAL_SIMULATION",
      "QUESTION_INTERNAL",
    ]),
    entityMentions: z.array(EntityMentionSchema).max(20),
    proposedActions: z.array(ProposedActionSchema).max(20),
    clarificationQuestion: z.string().min(1).max(500).nullable(),
  })
  .strict();

export type ReasoningOutput = z.infer<typeof ReasoningOutputSchema>;

export interface ProviderCallOptions {
  signal: AbortSignal;
}

export interface ReasoningRequest {
  input: string;
  locale: "de" | "en";
  context: {
    activeProjectSummary?: string;
  };
  toolSchemas: readonly StructuredToolBoundary[];
}

export interface StructuredToolBoundary {
  name: "resolve_species" | "preview_phase0_actions";
  description: string;
  readOnly: boolean;
  inputJsonSchema: Readonly<Record<string, unknown>>;
}

export interface SpeechRequest {
  audio: ArrayBuffer;
  contentType: string;
  localeHint?: "de" | "en";
  contextVocabulary: readonly string[];
}

export interface SpeechTranscript {
  text: string;
  detectedLocale: "de" | "en" | "unknown";
}

export interface ResearchRequest {
  question: string;
  requiredFreshness: "current";
}

export interface ResearchAnswer {
  answer: string;
  citations: Array<{ title: string; url: string }>;
}

export interface ReasoningProvider {
  readonly name: string;
  interpret(
    request: ReasoningRequest,
    options: ProviderCallOptions,
  ): Promise<unknown>;
}

export interface SpeechProvider {
  readonly name: string;
  transcribe(
    request: SpeechRequest,
    options: ProviderCallOptions,
  ): Promise<SpeechTranscript>;
}

export interface ResearchProvider {
  readonly name: string;
  research(
    request: ResearchRequest,
    options: ProviderCallOptions,
  ): Promise<ResearchAnswer>;
}

export type ProviderErrorCode =
  | "TIMEOUT"
  | "UNAVAILABLE"
  | "INVALID_OUTPUT"
  | "DISABLED";

export class ProviderError extends Error {
  readonly code: ProviderErrorCode;
  readonly provider: string;
  override readonly cause?: unknown;

  constructor(
    provider: string,
    code: ProviderErrorCode,
    message: string,
    cause?: unknown,
  ) {
    super(message);
    this.name = "ProviderError";
    this.provider = provider;
    this.code = code;
    this.cause = cause;
  }
}

export async function interpretWithValidation(
  provider: ReasoningProvider,
  request: ReasoningRequest,
  timeoutMs: number,
): Promise<ReasoningOutput> {
  const output = await callWithTimeout(
    provider.name,
    timeoutMs,
    (signal) => provider.interpret(request, { signal }),
  );
  const parsed = ReasoningOutputSchema.safeParse(output);
  if (!parsed.success) {
    throw new ProviderError(
      provider.name,
      "INVALID_OUTPUT",
      "Reasoning provider output did not satisfy the structured contract.",
      parsed.error,
    );
  }
  return parsed.data;
}

export async function callWithTimeout<T>(
  provider: string,
  timeoutMs: number,
  call: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) {
    throw new Error("Provider timeout must be a positive safe integer.");
  }
  const controller = new AbortController();
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timeoutHandle = setTimeout(() => {
      controller.abort("provider-timeout");
      reject(
        new ProviderError(
          provider,
          "TIMEOUT",
          `Provider call exceeded ${timeoutMs} ms.`,
        ),
      );
    }, timeoutMs);
  });

  try {
    return await Promise.race([call(controller.signal), timeout]);
  } catch (error) {
    if (error instanceof ProviderError) {
      throw error;
    }
    throw new ProviderError(
      provider,
      "UNAVAILABLE",
      "Provider call failed.",
      error,
    );
  } finally {
    if (timeoutHandle !== undefined) {
      clearTimeout(timeoutHandle);
    }
  }
}

export class DisabledResearchProvider implements ResearchProvider {
  readonly name = "disabled";

  research(
    request: ResearchRequest,
    options: ProviderCallOptions,
  ): Promise<ResearchAnswer> {
    void request;
    void options;
    return Promise.reject(
      new ProviderError(
        this.name,
        "DISABLED",
        "External research is not enabled for the Phase 0 spike.",
      ),
    );
  }
}
