import { describe, expect, it } from "vitest";

import {
  DisabledResearchProvider,
  callWithTimeout,
  interpretWithValidation,
  type ReasoningProvider,
  type ReasoningRequest,
} from "../src/providers/contracts.ts";
import {
  ScriptedReasoningProvider,
  ScriptedSpeechProvider,
} from "../src/providers/test-doubles.ts";

const request: ReasoningRequest = {
  input: "Ich habe drei Surfent.",
  locale: "de",
  context: {},
  toolSchemas: [
    {
      name: "resolve_species",
      description: "Return canonical candidates; never invent an entity.",
      readOnly: true,
      inputJsonSchema: {
        type: "object",
        properties: { mention: { type: "string" } },
        required: ["mention"],
        additionalProperties: false,
      },
    },
  ],
};

describe("provider adapter boundaries", () => {
  it("accepts a schema-valid action draft that still contains only mentions", async () => {
    const provider = new ScriptedReasoningProvider([
      {
        intent: "INVENTORY_MUTATION",
        entityMentions: [{ kind: "species", text: "Surfent" }],
        proposedActions: [
          {
            type: "ADD_BULK_COPIES",
            speciesMention: "Surfent",
            amount: 3,
          },
        ],
        clarificationQuestion: null,
      },
    ]);

    const result = await interpretWithValidation(provider, request, 500);
    expect(result.proposedActions[0]).toMatchObject({
      speciesMention: "Surfent",
    });
    expect(JSON.stringify(result)).not.toContain("FairyDragon");
  });

  it("rejects extra canonical IDs invented outside the resolver boundary", async () => {
    const provider = new ScriptedReasoningProvider([
      {
        intent: "INVENTORY_MUTATION",
        entityMentions: [{ kind: "species", text: "Surfent" }],
        proposedActions: [
          {
            type: "ADD_BULK_COPIES",
            speciesMention: "Surfent",
            speciesId: 75,
            amount: 3,
          },
        ],
        clarificationQuestion: null,
      },
    ]);

    await expect(
      interpretWithValidation(provider, request, 500),
    ).rejects.toMatchObject({ code: "INVALID_OUTPUT" });
  });

  it("normalizes provider failures to an unavailable error contract", async () => {
    const provider = new ScriptedReasoningProvider([]);
    await expect(
      interpretWithValidation(provider, request, 500),
    ).rejects.toMatchObject({ code: "UNAVAILABLE" });
  });

  it("aborts and reports a deterministic timeout", async () => {
    let observedSignal: AbortSignal | undefined;
    const provider: ReasoningProvider = {
      name: "never-settles",
      interpret(_providerRequest, options) {
        observedSignal = options.signal;
        return new Promise(() => undefined);
      },
    };

    await expect(
      interpretWithValidation(provider, request, 10),
    ).rejects.toMatchObject({ code: "TIMEOUT" });
    expect(observedSignal?.aborted).toBe(true);
  });

  it("keeps external research disabled behind its own adapter", async () => {
    const provider = new DisabledResearchProvider();
    await expect(
      provider.research(
        { question: "current availability", requiredFreshness: "current" },
        { signal: new AbortController().signal },
      ),
    ).rejects.toMatchObject({ code: "DISABLED" });
  });

  it("provides a speech test double without coupling speech to mutation", async () => {
    const provider = new ScriptedSpeechProvider({
      text: "three Surfent",
      detectedLocale: "en",
    });
    const result = await callWithTimeout(provider.name, 500, (signal) =>
      provider.transcribe(
        {
          audio: new ArrayBuffer(0),
          contentType: "audio/webm",
          contextVocabulary: ["Surfent"],
        },
        { signal },
      ),
    );
    expect(result).toEqual({ text: "three Surfent", detectedLocale: "en" });
  });
});
