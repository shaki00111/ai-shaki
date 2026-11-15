import test from "node:test";
import assert from "node:assert/strict";
import { canUseWusRouterTextFallback } from "../src/providerRouting.ts";

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


test("Gemini project eligibility errors are distinct from healthy key pings and ordinary quota errors", async () => {
  const { isGeminiProjectUnavailableError } = await import("../src/providerRouting.ts");
  assert.equal(isGeminiProjectUnavailableError("The Gemini API free tier is not available for this project. Enable billing."), true);
  assert.equal(isGeminiProjectUnavailableError("project-unavailable"), true);
  assert.equal(isGeminiProjectUnavailableError("API key not valid"), false);
  assert.equal(isGeminiProjectUnavailableError("Quota exceeded"), false);
  assert.equal(isGeminiProjectUnavailableError("Service temporarily unavailable"), false);
});
