import test from "node:test";
import assert from "node:assert/strict";
import { ProviderKeyCooldowns } from "../src/ttsReliability.ts";

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
