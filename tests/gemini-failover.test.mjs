import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { geminiErrorWithHttpStatus, geminiStreamError } from "../src/geminiErrors.ts";
import { selectGeminiKeyIndex, shouldRetryGeminiQuotaImmediately } from "../src/geminiKeySelection.ts";
import { mergeGeminiKeys, hasGeminiKeyAfterUpdate } from "../src/geminiKeyring.ts";

const key = "test-key-abcdef0123456789";

test("an HTTP 429 JSON error without a code is recognized as quota", () => {
  const payload = geminiErrorWithHttpStatus({ error: { message: "Too many requests" } }, 429);
  assert.equal(payload.error.code, 429);
  assert.match(geminiStreamError(payload.error, key).message, /^GEMINI_QUOTA\|429\|/);
});

test("an SSE 429 is recognized by its code even when the message is generic", () => {
  assert.match(geminiStreamError({ code: 429, message: "Request exhausted" }, key).message, /^GEMINI_QUOTA\|429\|/);
  assert.match(geminiStreamError({ message: "Rate limit reached" }, key).message, /^GEMINI_QUOTA\|429\|/);
});

test("errors preserve existing upstream codes, auth and safety distinctions", () => {
  assert.equal(geminiErrorWithHttpStatus({ error: { code: 403, message: "Forbidden" } }, 400).error.code, 403);
  assert.equal(geminiStreamError({ code: 401, message: "Rejected" }, key).message, "auth: unauthorized");
  assert.equal(geminiStreamError({ code: 403, message: "Permission denied" }, key).message, "Gemini HTTP 403: Permission denied");
  assert.equal(geminiStreamError({ message: "safety policy" }, key).message, "blocked by safety filter");
});

test("provider responses redact raw and URL encoded keys before surfacing errors", () => {
  const credential = "secret key/abc123456";
  const err = geminiStreamError({ code: 429, message: `${credential} ${encodeURIComponent(credential)} quota` }, credential);
  assert.ok(!err.message.includes(credential));
  assert.ok(!err.message.includes(encodeURIComponent(credential)));
  assert.match(err.message, /\[redacted\]/);
});

test("same-millisecond selection never repeats an attempted key", () => {
  const keys = ["a", "b", "c"];
  const attempted = new Set();
  const lastUsed = new Map();
  const selected = [];
  for (let i = 0; i < keys.length; i++) {
    const index = selectGeminiKeyIndex(keys, {}, lastUsed, 10, i, attempted);
    assert.notEqual(index, -1);
    selected.push(keys[index]);
    attempted.add(keys[index]);
    lastUsed.set(keys[index], 10);
  }
  assert.equal(new Set(selected).size, 3);
  assert.equal(selectGeminiKeyIndex(keys, {}, lastUsed, 10, 0, attempted), -1);
});

test("exclusion does not bypass active cooldowns and does not change existing callers", () => {
  const keys = ["a", "b", "c"];
  assert.equal(selectGeminiKeyIndex(keys, { b: 100 }, new Map(), 50, 0, new Set(["a"])), 2);
  assert.equal(selectGeminiKeyIndex(keys, { b: 100, c: 100 }, new Map(), 50, 0, new Set(["a"])), -1);
  assert.equal(selectGeminiKeyIndex(keys, {}, new Map(), 50), 0);
});

test("heavy generation only inserts bounded immediate retries for quota with an eligible key", () => {
  assert.equal(shouldRetryGeminiQuotaImmediately("GEMINI_QUOTA|429|per minute", "nextKey", 0, 5, true), true);
  assert.equal(shouldRetryGeminiQuotaImmediately("429", "nextKey", 3, 5, true), true);
  assert.equal(shouldRetryGeminiQuotaImmediately("429", "nextKey", 4, 5, true), false);
  assert.equal(shouldRetryGeminiQuotaImmediately("429", "nextKey", 0, 5, false), false);
  assert.equal(shouldRetryGeminiQuotaImmediately("overloaded", "nextModel", 0, 5, true), false);
  assert.equal(shouldRetryGeminiQuotaImmediately("429", "nextKey", 0, 1, true), false);
});

test("keyring rebuild excludes disabled and deleted managed keys without removing environment keys", () => {
  const env = ['environment', undefined, 'duplicate'];
  const managed = [{ key: 'active', enabled: true }, { key: 'disabled', enabled: false }, { key: 'duplicate', enabled: true }];
  assert.deepEqual(mergeGeminiKeys(env, managed), ['environment', 'duplicate', 'active']);
  assert.deepEqual(mergeGeminiKeys(env, []), ['environment', 'duplicate']);
  assert.equal(hasGeminiKeyAfterUpdate([], [{ key: 'last', enabled: false }]), false);
  assert.equal(hasGeminiKeyAfterUpdate([], []), false);
  assert.equal(hasGeminiKeyAfterUpdate(['environment'], []), true);
  assert.equal(hasGeminiKeyAfterUpdate([], [{ key: 'last', enabled: true }]), true);
});

test("worker routes HTTP and SSE failures through normalization and uses per-model attempt exclusion", () => {
  const source = readFileSync(new URL("../src/index.ts", import.meta.url), "utf8");
  assert.match(source, /geminiErrorWithHttpStatus\(one, response\.status\)/);
  assert.match(source, /throw geminiStreamError\(data\.error, apiKey\)/);
  assert.match(source, /getGeminiKey\(offset, attemptedKeys\)/);
  assert.match(source, /attemptedKeys\.add\(keyInfo\.key\)/);
  assert.match(source, /plan\.splice\(planIndex \+ 1, 0, \{ \.\.\.step, retryDelayMs: 0 \}\)/);
  assert.match(source, /mergeGeminiKeys\(environmentGeminiKeys\(env\), managed\)/);
  assert.match(source, /hasGeminiKeyAfterUpdate\(environmentGeminiKeys\(env\), next\)/);
  assert.doesNotMatch(source, /API Key \$\{key\.slice/);
});
