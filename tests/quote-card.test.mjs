import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { quoteCardSvg } from "../src/quoteCard.ts";

test("creates a self-contained dark Persian SVG card", () => {
  const svg = quoteCardSvg("سلام شاکی\nامروز روز خوبیه");
  assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  assert.match(svg, /direction="rtl"/);
  assert.match(svg, /سلام شاکی/);
  assert.match(svg, /AI SHAKI/);
  assert.doesNotMatch(svg, /<script|<image|<foreignObject/i);
});

test("escapes markup in user text and removes invalid XML control characters", () => {
  const svg = quoteCardSvg('<script> & "hello"\u0000');
  assert.ok(!svg.includes("<script>"));
  assert.ok(svg.includes("&lt;script&gt;"));
  assert.ok(svg.includes("&amp;"));
  assert.ok(!svg.includes("\u0000"));
});

test("enforces bounded input and line count without silently truncating", () => {
  assert.equal(quoteCardSvg("   "), null);
  assert.equal(quoteCardSvg("x".repeat(361)), null);
  assert.equal(quoteCardSvg(Array(13).fill("a").join("\n")), null);
  assert.equal(quoteCardSvg("\ud800"), null);
  assert.ok(quoteCardSvg("x".repeat(360)));
});

test("wraps long words and handles non-BMP characters", () => {
  const svg = quoteCardSvg("😀".repeat(40));
  const textLines = [...svg.matchAll(/<text x="110" y="(\d+)" direction="ltr"[^>]*>(.*?)<\/text>/g)];
  assert.equal(textLines.length, 2);
  assert.equal(textLines.map(match => match[2]).join(""), "😀".repeat(40));
});

test("command uses explicit text or a reply and retains group gates and rate limits", () => {
  const src = readFileSync(new URL("../src/index.ts", import.meta.url), "utf8");
  const start = src.indexOf('case "/card":');
  const end = src.indexOf('case "/leaderboard":', start);
  const command = src.slice(start, end);
  assert.ok(start > src.indexOf('if (chat.type !== "private" && !await isGroupEnabled'));
  assert.match(command, /msg\.reply_to_message\?\.text/);
  assert.match(command, /quoteCardSvg\(content\)/);
  assert.match(command, /isDuplicateUserRequest/);
  assert.match(command, /getUserBucket\(from\.id, session\.vipStatus\)\.tryConsume/);
  assert.match(command, /sendTelegramDocument.*"shaki-card\.svg"/);
  assert.match(command, /"image\/svg\+xml"/);
});
