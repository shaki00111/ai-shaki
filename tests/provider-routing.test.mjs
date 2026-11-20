import test from "node:test";
import assert from "node:assert/strict";
import { canUseWusRouterTextFallback, getWusRouterModelCandidates } from "../src/providerRouting.ts";

const eligible = {
  enabled: true,
  configured: true,
  plainTextTurn: true,
  plainTextHistory: true,
  intentCategory: "conversation",
  remainingMs: 5_000,
};

test("ordinary text turns can use an enabled and configured WusRouter fallback", () => {
  assert.equal(canUseWusRouterTextFallback(eligible), true);
  for (const intentCategory of ["activation", "general_knowledge", "conversation"]) {
    assert.equal(canUseWusRouterTextFallback({ ...eligible, intentCategory }), true);
  }
});

test("owner toggle and missing credentials always disable WusRouter fallback", () => {
  assert.equal(canUseWusRouterTextFallback({ ...eligible, enabled: false }), false);
  assert.equal(canUseWusRouterTextFallback({ ...eligible, configured: false }), false);
});

test("media, tool, and non-chat history never enter the text-only fallback", () => {
  assert.equal(canUseWusRouterTextFallback({ ...eligible, plainTextTurn: false }), false);
  assert.equal(canUseWusRouterTextFallback({ ...eligible, plainTextHistory: false }), false);
  for (const intentCategory of ["image_generate", "image_edit", "research", "moderation", "document_create", "voice_request"]) {
    assert.equal(canUseWusRouterTextFallback({ ...eligible, intentCategory }), false);
  }
});

test("fallback requires enough remaining time and an available model-call budget", () => {
  assert.equal(canUseWusRouterTextFallback({ ...eligible, remainingMs: 4_999 }), false);
  assert.equal(canUseWusRouterTextFallback({ ...eligible, remainingMs: Number.POSITIVE_INFINITY }), false);
  assert.equal(canUseWusRouterTextFallback({ ...eligible, modelBudgetAvailable: false }), false);
});


test("WusRouter fallback selects only model IDs advertised to the current key", () => {
  const payload = { data: [
    { id: "wusrouter/paid-large" },
    { id: "wusrouter/qwen3-coder:free" },
    { id: "wusrouter/qwen3.8-flash" },
    { id: "wusrouter/llama-small" },
  ] };
  assert.deepEqual(
    getWusRouterModelCandidates(payload, "wusrouter/qwen3.8-flash:free"),
    ["wusrouter/qwen3.8-flash", "wusrouter/qwen3-coder:free", "wusrouter/llama-small", "wusrouter/paid-large"],
  );
  assert.deepEqual(
    getWusRouterModelCandidates(payload, "wusrouter/qwen3-coder:free"),
    ["wusrouter/qwen3-coder:free", "wusrouter/qwen3.8-flash", "wusrouter/llama-small", "wusrouter/paid-large"],
  );
  assert.deepEqual(getWusRouterModelCandidates({ data: [] }, "missing-model"), []);
});

test("provider settings POST response keeps Groq credential visibility consistent with GET", async () => {
  const source = await import("node:fs").then(({ readFileSync }) => readFileSync(new URL("../src/index.ts", import.meta.url), "utf8"));
  const getRoute = source.slice(source.indexOf('request.method === "GET" && path === "providers"'), source.indexOf('request.method === "POST" && path === "providers"'));
  const postRoute = source.slice(source.indexOf('request.method === "POST" && path === "providers"'), source.indexOf('request.method === "GET" && path === "business"'));
  assert.match(getRoute, /groq:groqKeysFromEnv\(env as unknown as Record<string, unknown>\)\.length>0/);
  assert.match(postRoute, /groq:groqKeysFromEnv\(env as unknown as Record<string, unknown>\)\.length>0/);
});

test("text-only Groq and WusRouter fallbacks join text parts with real line breaks", async () => {
  const { readFileSync } = await import("node:fs");
  const source = readFileSync(new URL("../src/index.ts", import.meta.url), "utf8");
  assert.equal((source.match(/parts\\.map\\(part=>part\\.text\\?\\?""\\)\\.join\\("\\\\n"\\)/g) || []).length, 4);
  assert.equal((source.match(/parts\\.map\\(part=>part\\.text\\?\\?""\\)\\.join\\("\\\\\\\\n"\\)/g) || []).length, 0);
});
