import test from "node:test";
import assert from "node:assert/strict";
import { shouldSendMaintenanceNotice, MAINTENANCE_NOTICE_TEXT } from "../src/maintenanceNotice.ts";

test("all private messages receive the temporary maintenance notice", () => {
  assert.equal(shouldSendMaintenanceNotice({ chatType: "private", replyToBot: false }), true);
});

test("group notice is sent only when the bot is addressed", () => {
  assert.equal(shouldSendMaintenanceNotice({ chatType: "group", text: "hello everyone", replyToBot: false }), false);
  assert.equal(shouldSendMaintenanceNotice({ chatType: "supergroup", text: "hey @AI_SHAKI_BOT help", replyToBot: false }), true);
  assert.equal(shouldSendMaintenanceNotice({ chatType: "group", replyToBot: true }), true);
  assert.equal(shouldSendMaintenanceNotice({ chatType: "group", entities: [{ type: "text_mention", offset: 0, length: 4, user: { id: 123 } }], botId: 123, replyToBot: false }), true);
});

test("channel posts and unrelated group messages do not trigger the notice", () => {
  assert.equal(shouldSendMaintenanceNotice({ chatType: "channel", text: "@AI_SHAKI_BOT", replyToBot: false }), false);
  assert.equal(shouldSendMaintenanceNotice({ chatType: "group", text: "@someone_else", replyToBot: false }), false);
});

test("notice text matches the requested Persian copy", () => {
  assert.equal(MAINTENANCE_NOTICE_TEXT, "🛠️ در حال بروزرسانی\n\nنوا در حال به‌روزرسانی است و الان پاسخ نمی‌دهد. چند دقیقه‌ی دیگر دوباره امتحان کن.");
});
