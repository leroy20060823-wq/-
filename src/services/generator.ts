import Anthropic from "@anthropic-ai/sdk";
import { anthropic } from "../anthropic.js";
import { config } from "../config.js";
import type { GenerationModule } from "../modules.js";

/** A user-supplied source-material file (photo / PDF) sent to the model. */
export interface Attachment {
  kind: "image" | "pdf";
  mediaType: "image/jpeg" | "image/png" | "image/gif" | "image/webp" | "application/pdf";
  /** base64-encoded bytes, no data: URL prefix. */
  data: string;
}

export interface GenerateOptions {
  module: GenerationModule;
  input: string;
  /** Normalized user-selected option values (e.g. { difficulty: "중", count: 10 }). */
  optionValues?: Record<string, string | number>;
  /** Optional caller override; takes precedence over the module's model. */
  model?: string;
  /** Pasted source material (textbook passages, etc.). Triggers grounded mode. */
  sourceText?: string;
  /** Uploaded source material (photos / PDF). Triggers grounded mode. */
  attachments?: Attachment[];
}

// Default source directives (used when a source-enabled module doesn't override).
const DEFAULT_GROUNDED_DIRECTIVE = [
  "## 자료 기반 생성 (중요)",
  "사용자가 자료(붙여넣은 본문 또는 업로드한 사진·PDF)를 제공했습니다. 결과물은 반드시 이 자료의 실제 내용을 근거로 만드세요. 지문·어휘·문항·예시를 자료에서 끌어내고, 자료와 무관한 내용을 새로 지어내지 마세요.",
  "사진이나 페이지가 흐릿하거나 잘려서 읽을 수 없으면, 추측해서 채우지 말고 어느 부분(몇 번째 사진/페이지)을 읽지 못했는지 결과 맨 앞에 한 줄로 알려주고 더 선명한 사진을 요청하세요.",
  "이 지침이 위의 다른 지침과 충돌하면 이 지침을 우선합니다.",
].join("\n");
const DEFAULT_TOPIC_DIRECTIVE =
  "사용자가 본문 자료를 제공하지 않았습니다. 제공된 주제·범위에 맞춰 새롭고 독창적인 내용을 직접 만드세요.";

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

/** Grounded mode = the user provided source material (text and/or files). */
export function isGrounded(options: GenerateOptions): boolean {
  return (options.attachments?.length ?? 0) > 0 || !!(options.sourceText && options.sourceText.trim());
}

// System prompt + optional few-shot reference + (for source-enabled modules) the
// grounded/topic directive.
function buildSystemPrompt(module: GenerationModule, grounded: boolean): string {
  const parts = [module.systemPrompt];
  if (module.referenceExample) {
    parts.push(
      "",
      "## 참고 예시 (스타일·품질 기준)",
      "다음은 기대하는 결과물의 스타일과 품질 수준을 보여주는 예시입니다. 내용을 그대로 베끼지 말고, 형식·구성·완성도를 이 수준으로 맞추세요.",
      "",
      module.referenceExample,
    );
  }
  if (module.source?.enabled) {
    parts.push(
      "",
      grounded
        ? module.source.groundedDirective || DEFAULT_GROUNDED_DIRECTIVE
        : module.source.topicDirective || DEFAULT_TOPIC_DIRECTIVE,
    );
  }
  return parts.join("\n");
}

// The user-turn text: form input + pasted source block + a "[요청 조건]" block
// built from the selected option values (kept in the user turn for cache stability).
function buildUserText(options: GenerateOptions): string {
  let text = options.input ?? "";
  const src = (options.sourceText ?? "").trim();
  if (src) text += `${text ? "\n\n" : ""}---\n[제공된 본문 자료]\n${src}`;

  const values = options.optionValues ?? {};
  const lines: string[] = [];
  for (const opt of options.module.options ?? []) {
    const value = values[opt.key];
    if (value === undefined || value === "") continue;
    lines.push(`- ${opt.label}: ${value}`);
  }
  if (lines.length) text += `${text ? "\n\n" : ""}---\n[요청 조건]\n${lines.join("\n")}`;
  return text;
}

// Full user-turn content: a string when there are no files, or a content-block
// array (text + image/document blocks) when photos/PDFs are attached.
export function buildUserContent(options: GenerateOptions): string | Anthropic.ContentBlockParam[] {
  const text = buildUserText(options);
  const atts = options.attachments ?? [];
  if (atts.length === 0) return text;

  const blocks: Anthropic.ContentBlockParam[] = [
    {
      type: "text",
      text: `${text}\n\n---\n아래는 사용자가 올린 자료입니다. 이 자료의 내용을 근거로 만들어 주세요.`,
    },
  ];
  for (const a of atts) {
    if (a.kind === "pdf") {
      blocks.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: a.data } });
    } else {
      blocks.push({
        type: "image",
        source: { type: "base64", media_type: a.mediaType as Anthropic.Base64ImageSource["media_type"], data: a.data },
      });
    }
  }
  return blocks;
}

/**
 * One-shot generation. Sends [system prompt (+ reference) ] and [user input
 * (+ 요청 조건)] to Claude and returns the full text.
 */
export async function generate(options: GenerateOptions): Promise<GenerateResult> {
  const response = await anthropic.messages.create({
    model: resolveModel(options),
    max_tokens: resolveMaxTokens(options.module),
    system: buildSystemPrompt(options.module, isGrounded(options)),
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
    system: buildSystemPrompt(options.module, isGrounded(options)),
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
