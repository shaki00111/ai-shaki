import test from "node:test";
import assert from "node:assert/strict";
import { ProviderKeyCooldowns } from "../src/ttsReliability.ts";
import { buildGeminiTtsRequest, extractGeminiTtsAudio } from "../src/geminiTtsProtocol.ts";

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

test("Gemini TTS ignores absent or too-short audio payloads", () => {
  assert.equal(extractGeminiTtsAudio({ output_audio: { data: "short" } }), null);
  assert.equal(extractGeminiTtsAudio({ candidates: [{ content: { parts: [{ text: "not audio" }] } }] }), null);
});
