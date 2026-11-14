import test from "node:test";
import assert from "node:assert/strict";
import { ProviderKeyCooldowns, isAudioContentType, getTelegramAudioDeliveryPlan } from "../src/ttsReliability.ts";
import { buildGeminiTtsRequest, extractGeminiTtsAudio, getGeminiTtsModels } from "../src/geminiTtsProtocol.ts";

test("TTS cooldowns are isolated per key and expire", () => {
  let now = 1_000;
  const cooldowns = new ProviderKeyCooldowns(() => now);
  cooldowns.disable("gemini-key-a", 5_000);
  assert.equal(cooldowns.isDisabled("gemini-key-a"), true);
  assert.equal(cooldowns.isDisabled("gemini-key-b"), false);
  assert.equal(cooldowns.remainingMs("gemini-key-a"), 5_000);
  now += 5_001;
  assert.equal(cooldowns.isDisabled("gemini-key-a"), false);
  assert.equal(cooldowns.remainingMs("gemini-key-a"), 0);
});

test("shorter responses cannot shorten a longer cooldown", () => {
  let now = 10_000;
  const cooldowns = new ProviderKeyCooldowns(() => now);
  cooldowns.disable("key", 60_000);
  cooldowns.disable("key", 2_000);
  assert.equal(cooldowns.remainingMs("key"), 60_000);
  now += 60_000;
  assert.equal(cooldowns.isDisabled("key"), false);
});

test("invalid cooldown inputs are ignored", () => {
  const cooldowns = new ProviderKeyCooldowns(() => 1_000);
  cooldowns.disable("", 10_000);
  cooldowns.disable("key", Number.NaN);
  cooldowns.disable("key", -1);
  assert.equal(cooldowns.isDisabled("key"), false);
});

 
test("Gemini 3.8 TTS uses the documented Interactions API payload", () => {
  assert.deepEqual(buildGeminiTtsRequest("gemini-3.8-flash-lite-tts", "سلام", "Despina"), {
    model: "gemini-3.8-flash-lite-tts",
    input: [{ type: "user_input", content: [{ type: "text", text: "سلام" }] }],
    response_format: { type: "audio" },
    generation_config: { speech_config: [{ voice: "Despina" }] },
  });
});

test("Gemini 3.1 preview TTS uses Interactions API text input", () => {
  assert.deepEqual(buildGeminiTtsRequest("gemini-3.1-flash-tts-preview", "Hello", "Kore"), {
    model: "gemini-3.1-flash-tts-preview",
    input: "Hello",
    response_format: { type: "audio" },
    generation_config: { speech_config: [{ voice: "Kore" }] },
  });
});

test("Gemini TTS extracts audio output in snake_case, camelCase, and output blocks", () => {
  const base64 = "A".repeat(128);
  assert.deepEqual(extractGeminiTtsAudio({ output_audio: { data: base64, mime_type: "audio/wav" } }), {
    data: base64, mimeType: "audio/wav",
  });
  assert.deepEqual(extractGeminiTtsAudio({ outputAudio: { data: base64, mimeType: "audio/ogg" } }), {
    data: base64, mimeType: "audio/ogg",
  });
  assert.deepEqual(extractGeminiTtsAudio({ output: [{ type: "audio", data: base64, mime_type: "audio/wav" }] }), {
    data: base64, mimeType: "audio/wav",
  });
});

test("Gemini TTS extracts raw REST audio from Interactions steps", () => {
  const base64 = "A".repeat(128);
  assert.deepEqual(extractGeminiTtsAudio({
    steps: [
      { type: "model_output", content: [{ type: "text", text: "ignored" }] },
      { type: "model_output", content: [{ type: "audio", data: base64, mime_type: "audio/wav" }] },
    ],
  }), { data: base64, mimeType: "audio/wav" });
});

test("Gemini TTS defaults missing REST MIME metadata to WAV", () => {
  const base64 = "A".repeat(128);
  assert.deepEqual(extractGeminiTtsAudio({
    steps: [{ type: "model_output", content: [{ type: "audio", data: base64 }] }],
  }), { data: base64, mimeType: "audio/wav" });
  assert.deepEqual(extractGeminiTtsAudio({
    output_audio: { data: base64, mime_type: "   " },
  }), { data: base64, mimeType: "audio/wav" });
});

test("Gemini TTS ignores absent or too-short audio payloads", () => {
  assert.equal(extractGeminiTtsAudio({ output_audio: { data: "short" } }), null);
  assert.equal(extractGeminiTtsAudio({ candidates: [{ content: { parts: [{ text: "not audio" }] } }] }), null);
});


test("Gemini TTS stops using the legacy preview model on its shutdown date", () => {
  assert.deepEqual(getGeminiTtsModels(Date.UTC(2026, 10, 16)), [
    "gemini-3.8-flash-lite-tts",
    "gemini-3.8-flash-tts",
    "gemini-3.1-flash-tts-preview",
  ]);
  assert.deepEqual(getGeminiTtsModels(Date.UTC(2026, 10, 17)), [
    "gemini-3.8-flash-lite-tts",
    "gemini-3.8-flash-tts",
  ]);
});


test("ElevenLabs cooldowns are isolated from Gemini cooldowns", async () => {
  const { elevenLabsKeyCooldowns, ttsKeyCooldowns } = await import("../src/ttsReliability.ts");
  elevenLabsKeyCooldowns.disable("shared-test-key", 30_000);
  assert.equal(elevenLabsKeyCooldowns.isDisabled("shared-test-key"), true);
  assert.equal(ttsKeyCooldowns.isDisabled("shared-test-key"), false);
});

test("Retry-After accepts seconds and HTTP dates and bounds invalid values", async () => {
  const { retryAfterDurationMs } = await import("../src/ttsReliability.ts");
  const now = Date.UTC(2026, 10, 14, 12, 0, 0);
  assert.equal(retryAfterDurationMs("12", now), 12_000);
  assert.equal(retryAfterDurationMs(new Date(now + 45_000).toUTCString(), now), 45_000);
  assert.equal(retryAfterDurationMs(null, now), 90_000);
  assert.equal(retryAfterDurationMs("nonsense", now), 90_000);
  assert.equal(retryAfterDurationMs("7200", now), 60 * 60_000);
});


test("ElevenLabs responses must explicitly identify as audio", () => {
  assert.equal(isAudioContentType("audio/mpeg"), true);
  assert.equal(isAudioContentType("audio/mpeg; charset=binary"), true);
  assert.equal(isAudioContentType("audio/ogg"), true);
  assert.equal(isAudioContentType("application/json"), false);
  assert.equal(isAudioContentType("text/html"), false);
  assert.equal(isAudioContentType(null), false);
});

test("Telegram voice delivery has compatible audio fallbacks", () => {
  assert.deepEqual(getTelegramAudioDeliveryPlan(false).map(x => x.method), [
    "sendVoice", "sendAudio", "sendDocument",
  ]);
  assert.deepEqual(getTelegramAudioDeliveryPlan(true).map(x => x.method), [
    "sendAudio", "sendDocument",
  ]);
  assert.equal(getTelegramAudioDeliveryPlan(false)[1].field, "audio");
  assert.equal(getTelegramAudioDeliveryPlan(true)[0].mimeType, "audio/wav");
});
