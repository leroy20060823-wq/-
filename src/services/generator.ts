import Anthropic from "@anthropic-ai/sdk";
import { anthropic } from "../anthropic.js";
import { config } from "../config.js";
import type { GenerationModule } from "../modules.js";

export interface GenerateOptions {
  module: GenerationModule;
  input: string;
  /** Optional caller override; takes precedence over the module's model. */
  model?: string;
}

export interface Usage {
  inputTokens: number;
  outputTokens: number;
}

export interface GenerateResult {
  content: string;
  model: string;
  usage: Usage;
}

function resolveModel(options: GenerateOptions): string {
  return options.model ?? options.module.model ?? config.defaultModel;
}

function resolveMaxTokens(module: GenerationModule): number {
  return module.maxTokens ?? config.defaultMaxTokens;
}

/**
 * One-shot generation. Sends [module system prompt + user input] to Claude and
 * returns the full text. Use this for shorter artifacts; for long outputs prefer
 * generateStream so the connection doesn't sit idle.
 */
export async function generate(options: GenerateOptions): Promise<GenerateResult> {
  const response = await anthropic.messages.create({
    model: resolveModel(options),
    max_tokens: resolveMaxTokens(options.module),
    system: options.module.systemPrompt,
    messages: [{ role: "user", content: options.input }],
  });

  // content is a list of typed blocks; keep only the text blocks.
  const content = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("");

  return {
    content,
    model: response.model,
    usage: {
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    },
  };
}

export type StreamEvent =
  | { type: "delta"; text: string }
  | { type: "done"; model: string; usage: Usage };

/**
 * Streaming generation. Yields incremental text deltas as they arrive, then a
 * final "done" event with the model and token usage. Preferred for long artifacts
 * (exams, decks) where a single non-streaming call could exceed the HTTP timeout.
 */
export async function* generateStream(
  options: GenerateOptions,
): AsyncGenerator<StreamEvent> {
  const stream = anthropic.messages.stream({
    model: resolveModel(options),
    max_tokens: resolveMaxTokens(options.module),
    system: options.module.systemPrompt,
    messages: [{ role: "user", content: options.input }],
  });

  for await (const event of stream) {
    if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
      yield { type: "delta", text: event.delta.text };
    }
  }

  const finalMessage = await stream.finalMessage();
  yield {
    type: "done",
    model: finalMessage.model,
    usage: {
      inputTokens: finalMessage.usage.input_tokens,
      outputTokens: finalMessage.usage.output_tokens,
    },
  };
}
