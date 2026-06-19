import Anthropic from "@anthropic-ai/sdk";
import { anthropic } from "../anthropic.js";
import { config } from "../config.js";
import type { GenerationModule } from "../modules.js";

export interface GenerateOptions {
  module: GenerationModule;
  input: string;
  /** Normalized user-selected option values (e.g. { difficulty: "중", count: 10 }). */
  optionValues?: Record<string, string | number>;
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

// Output ceiling: honor the module's preference but never above the hard cap
// (config.maxOutputTokens) — a cost guard so no module can request a huge output.
function resolveMaxTokens(module: GenerationModule): number {
  const want = module.maxTokens ?? config.defaultMaxTokens;
  return Math.min(want, config.maxOutputTokens);
}

// System prompt + optional few-shot style/quality reference.
function buildSystemPrompt(module: GenerationModule): string {
  if (!module.referenceExample) return module.systemPrompt;
  return [
    module.systemPrompt,
    "",
    "## 참고 예시 (스타일·품질 기준)",
    "다음은 기대하는 결과물의 스타일과 품질 수준을 보여주는 예시입니다. 내용을 그대로 베끼지 말고, 형식·구성·완성도를 이 수준으로 맞추세요.",
    "",
    module.referenceExample,
  ].join("\n");
}

// User input + a "[요청 조건]" block built from the selected option values, so the
// model's behavior stays in the user turn (keeps the system prompt cache-stable).
function buildUserContent(options: GenerateOptions): string {
  const values = options.optionValues ?? {};
  const lines: string[] = [];
  for (const opt of options.module.options ?? []) {
    const value = values[opt.key];
    if (value === undefined || value === "") continue;
    lines.push(`- ${opt.label}: ${value}`);
  }
  if (lines.length === 0) return options.input;
  return `${options.input}\n\n---\n[요청 조건]\n${lines.join("\n")}`;
}

/**
 * One-shot generation. Sends [system prompt (+ reference) ] and [user input
 * (+ 요청 조건)] to Claude and returns the full text.
 */
export async function generate(options: GenerateOptions): Promise<GenerateResult> {
  const response = await anthropic.messages.create({
    model: resolveModel(options),
    max_tokens: resolveMaxTokens(options.module),
    system: buildSystemPrompt(options.module),
    messages: [{ role: "user", content: buildUserContent(options) }],
  });

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
 * Streaming generation. Yields incremental text deltas, then a final "done"
 * event with the model and token usage.
 */
export async function* generateStream(
  options: GenerateOptions,
): AsyncGenerator<StreamEvent> {
  const stream = anthropic.messages.stream({
    model: resolveModel(options),
    max_tokens: resolveMaxTokens(options.module),
    system: buildSystemPrompt(options.module),
    messages: [{ role: "user", content: buildUserContent(options) }],
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
