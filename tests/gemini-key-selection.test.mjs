import test from "node:test";
import assert from "node:assert/strict";
import { selectGeminiKeyIndex } from "../src/geminiKeySelection.ts";

test("selects the least-recently-used key among keys outside cooldown", () => {
  const keys = ["a", "b", "c"];
  const lastUsed = new Map([["a", 10], ["b", 2], ["c", 5]]);
  assert.equal(selectGeminiKeyIndex(keys, { a: 0, b: 0, c: 0 }, lastUsed, 20, 0), 1);
});

test("never selects a key while its cooldown is active", () => {
  const keys = ["a", "b", "c"];
  const disabled = { a: 100, b: 0, c: 200 };
  assert.equal(selectGeminiKeyIndex(keys, disabled, new Map(), 50, 0), 1);
});

test("returns -1 instead of retrying the soonest disabled key when all keys are cooling down", () => {
  const keys = ["a", "b", "c"];
  const disabled = { a: 100, b: 80, c: 200 };
  assert.equal(selectGeminiKeyIndex(keys, disabled, new Map(), 50, 0), -1);
});

test("a key becomes eligible immediately after its cooldown expires", () => {
  const keys = ["a", "b"];
  const disabled = { a: 100, b: 150 };
  assert.equal(selectGeminiKeyIndex(keys, disabled, new Map(), 100, 0), 0);
});

test("selection order is deterministic when last-used timestamps tie", () => {
  const keys = ["a", "b", "c"];
  const lastUsed = new Map([["a", 5], ["b", 5], ["c", 5]]);
  assert.equal(selectGeminiKeyIndex(keys, {}, lastUsed, 10, 1), 1);
});

test("empty key pools return -1", () => {
  assert.equal(selectGeminiKeyIndex([], {}, new Map(), 10), -1);
});

test("recognizes Gemini project-level Free Tier ineligibility separately from model outages", async () => {
  const { isGeminiFreeTierProjectUnavailable } = await import("../src/geminiKeySelection.ts");
  assert.equal(isGeminiFreeTierProjectUnavailable("The Gemini API free tier is not available for this project."), true);
  assert.equal(isGeminiFreeTierProjectUnavailable("503 model overloaded"), false);
  assert.equal(isGeminiFreeTierProjectUnavailable("quota exceeded"), false);
});
