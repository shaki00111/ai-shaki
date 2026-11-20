import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { creativeImagePrompt } from "../src/creativeImages.ts";

test("all creative presets incorporate the user's text and their intended theme", () => {
  const input = "  پرتره فضایی  ";
  for (const [kind, theme] of [["avatar", /avatar/i], ["duo", /two people/i], ["story", /story/i], ["meme", /meme/i]]) {
    const prompt = creativeImagePrompt(kind, input);
    assert.match(prompt, theme);
    assert.ok(prompt.endsWith("پرتره فضایی"));
  }
});

test("empty or excessive prompts are rejected rather than triggering a provider", () => {
  assert.equal(creativeImagePrompt("avatar", "  "), null);
  assert.equal(creativeImagePrompt("story", "x".repeat(1001)), null);
  assert.ok(creativeImagePrompt("story", "x".repeat(1000)));
});

test("image shortcuts route through the existing quota-aware image handler", () => {
  const src = readFileSync(new URL("../src/index.ts", import.meta.url), "utf8");
  const start = src.indexOf('case "/avatar":');
  const end = src.indexOf('case "/findimg":', start);
  const block = src.slice(start, end);
  assert.ok(start > src.indexOf('if (chat.type !== "private" && !await isGroupEnabled'));
  for (const command of ["avatar", "duo", "story", "meme"]) assert.ok(block.includes(`case "/${command}":`));
  assert.match(block, /creativeImagePrompt\(kind, args\.join\(" "\)\)/);
  assert.match(block, /await handleImg\(msg, \[prompt\], env\)/);
  assert.match(block, /does not edit uploaded photos/);
});
