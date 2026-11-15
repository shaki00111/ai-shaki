import test from "node:test";
import assert from "node:assert/strict";
import { GEMINI_KEY_RETRY_DELAY_MS, GROUP_SERVER_STUCK_NOTICE, isGroupChatId } from "../src/failureRouting.ts";

test("Gemini failover waits exactly five seconds before trying another key", () => {
  assert.equal(GEMINI_KEY_RETRY_DELAY_MS, 5_000);
});

test("only Telegram group chat IDs are treated as groups", () => {
  assert.equal(isGroupChatId(-1001234567890), true);
  assert.equal(isGroupChatId(-123456), true);
  assert.equal(isGroupChatId(123456), false);
  assert.equal(isGroupChatId(0), false);
});

test("group-facing failure notice contains no provider error details", () => {
  assert.match(GROUP_SERVER_STUCK_NOTICE, /سرور فعلاً گیر کرده/);
  assert.match(GROUP_SERVER_STUCK_NOTICE, /فقط برای مالک ربات/);
  assert.doesNotMatch(GROUP_SERVER_STUCK_NOTICE, /Gemini|429|API key|stack/i);
});
