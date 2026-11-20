import test from "node:test";
import assert from "node:assert/strict";
import { selectGeminiKeyIndex } from "../src/geminiKeySelection.ts";
import { numberedGeminiKeysFromEnv } from "../src/geminiKeyring.ts";

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

test("discovers all numbered Gemini secrets, including key six and keys above ten", () => {
  assert.deepEqual(numberedGeminiKeysFromEnv({
    GEMINI_KEY_1: " first ",
    GEMINI_KEY_5: "fifth",
    GEMINI_KEY_6: " sixth ",
    GEMINI_KEY_10: "tenth",
    GEMINI_KEY_100: "hundredth",
    GEMINI_KEY_101: "outside-limit",
    GEMINI_KEY_BAD: "ignored",
    GEMINI_KEY_2: "   ",
  }), ["first", "fifth", "sixth", "tenth", "hundredth"]);
});
