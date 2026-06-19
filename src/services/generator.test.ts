import { test } from "node:test";
import assert from "node:assert/strict";
import { buildUserContent, isGrounded } from "./generator.js";
import { getModule } from "../modules.js";

const exam = getModule("exam")!;

test("isGrounded reflects whether material was provided", () => {
  assert.equal(isGrounded({ module: exam, input: "주제만" }), false);
  assert.equal(isGrounded({ module: exam, input: "", sourceText: "지문" }), true);
  assert.equal(
    isGrounded({ module: exam, input: "", attachments: [{ kind: "image", mediaType: "image/png", data: "AAAA" }] }),
    true,
  );
});

test("buildUserContent returns a plain string when there are no attachments", () => {
  const content = buildUserContent({ module: exam, input: "과목: 영어" });
  assert.equal(typeof content, "string");
});

test("buildUserContent folds pasted source text into a labeled block", () => {
  const content = buildUserContent({ module: exam, input: "과목: 영어", sourceText: "This is the passage." });
  assert.equal(typeof content, "string");
  assert.match(content as string, /\[제공된 본문 자료\]/);
  assert.match(content as string, /This is the passage\./);
});

test("buildUserContent returns content blocks (text + image) when photos are attached", () => {
  const content = buildUserContent({
    module: exam,
    input: "과목: 영어",
    attachments: [
      { kind: "image", mediaType: "image/jpeg", data: "AAAA" },
      { kind: "pdf", mediaType: "application/pdf", data: "BBBB" },
    ],
  });
  assert.ok(Array.isArray(content));
  const blocks = content as Array<{ type: string; source?: { media_type?: string } }>;
  assert.equal(blocks[0]!.type, "text");
  assert.equal(blocks[1]!.type, "image");
  assert.equal(blocks[1]!.source?.media_type, "image/jpeg");
  assert.equal(blocks[2]!.type, "document");
  assert.equal(blocks[2]!.source?.media_type, "application/pdf");
});
