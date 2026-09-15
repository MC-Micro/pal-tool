import type {
  ProviderCallOptions,
  ReasoningProvider,
  ReasoningRequest,
  SpeechProvider,
  SpeechRequest,
  SpeechTranscript,
} from "./contracts.ts";

export class ScriptedReasoningProvider implements ReasoningProvider {
  readonly name = "scripted-reasoning-test-double";
  readonly #outputs: unknown[];

  constructor(outputs: unknown[]) {
    this.#outputs = [...outputs];
  }

  interpret(
    _request: ReasoningRequest,
    options: ProviderCallOptions,
  ): Promise<unknown> {
    if (options.signal.aborted) {
      return Promise.reject(new Error("Provider call was aborted."));
    }
    if (this.#outputs.length === 0) {
      return Promise.reject(new Error("No scripted reasoning output remains."));
    }
    return Promise.resolve(this.#outputs.shift());
  }
}

export class ScriptedSpeechProvider implements SpeechProvider {
  readonly name = "scripted-speech-test-double";
  readonly #transcript: SpeechTranscript;

  constructor(transcript: SpeechTranscript) {
    this.#transcript = transcript;
  }

  transcribe(
    _request: SpeechRequest,
    options: ProviderCallOptions,
  ): Promise<SpeechTranscript> {
    return options.signal.aborted
      ? Promise.reject(new Error("Provider call was aborted."))
      : Promise.resolve(this.#transcript);
  }
}
