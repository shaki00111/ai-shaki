import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dailyChallengeText } from "../src/dailyChallenge.ts";

const date = (value) => new Date(value);

test("the daily challenge is shared and stable throughout the same UTC day", () => {
  const early = dailyChallengeText(date("2026-11-17T00:00:00Z"), "fa");
  const late = dailyChallengeText(date("2026-11-17T23:59:59Z"), "fa");
  assert.equal(early, late);
  assert.match(early, /2026-11-17 UTC/);
  assert.match(early, /چالش روزانه شاکی/);
});

test("the challenge changes at UTC midnight and cycles predictably", () => {
  const yesterday = dailyChallengeText(date("2026-11-16T23:59:59Z"), "en");
  const today = dailyChallengeText(date("2026-11-17T00:00:00Z"), "en");
  assert.notEqual(yesterday.split("\n\n")[1], today.split("\n\n")[1]);
  const inTwoWeeks = dailyChallengeText(date("2026-12-01T00:00:00Z"), "en");
  assert.equal(today.split("\n\n")[1], inTwoWeeks.split("\n\n")[1]);
});

test("Persian, English and Arabic versions use the same challenge with English fallback", () => {
  const now = date("1970-01-01T12:00:00Z");
  assert.match(dailyChallengeText(now, "fa"), /پنج کلمه/);
  assert.match(dailyChallengeText(now, "en"), /five words/);
  assert.match(dailyChallengeText(now, "ar"), /خمس كلمات/);
  assert.equal(dailyChallengeText(now, "unknown"), dailyChallengeText(now, "en"));
});

test("pre-epoch dates use valid modulo and invalid dates are rejected", () => {
  assert.match(dailyChallengeText(date("1969-12-31T23:59:59Z"), "en"), /interesting question/);
  assert.throws(() => dailyChallengeText(new Date(NaN), "en"), RangeError);
});

test("all 14 UTC days have nonempty distinct challenges in each supported language", () => {
  for (const language of ["fa", "en", "ar"]) {
    const prompts = Array.from({ length: 14 }, (_, i) => dailyChallengeText(new Date(i * 86_400_000), language).split("\n\n")[1]);
    assert.equal(new Set(prompts).size, 14);
    assert.ok(prompts.every(Boolean));
  }
});

test("the command is wired after existing access gates and documented in both guides", () => {
  const source = readFileSync(new URL("../src/index.ts", import.meta.url), "utf8");
  const gate = source.indexOf('if (chat.type !== "private" && !await isGroupEnabled');
  const command = source.indexOf('case "/challenge":');
  assert.ok(gate !== -1 && command > gate);
  assert.match(source.slice(command, command + 300), /dailyChallengeText\(new Date\(\), session\.language\)/);
  assert.match(source.slice(command, command + 300), /reply_to_message_id: msg\.message_id/);
  assert.equal((source.match(/\\`\/challenge\\`/g) ?? []).length, 4);
});
