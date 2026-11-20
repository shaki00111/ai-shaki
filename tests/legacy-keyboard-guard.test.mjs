import test from "node:test";
import assert from "node:assert/strict";
import {
  classifyLegacyKeyboardUpdate,
  removeLegacyReplyKeyboard,
} from "../src/legacyKeyboardGuard.ts";

const update = (text, chatId = 123) => ({
  message: { text, chat: { id: chatId } },
});

test("start and panel commands clear any stale persistent Telegram keyboard", () => {
  for (const text of ["/start", "/start@AI_SHAKI_BOT", "/panel", "/panel@AI_SHAKI_BOT", "/keyboard", "/keypanel", "پنل"]) {
    assert.equal(classifyLegacyKeyboardUpdate(update(text)), "clear", text);
  }
});

test("old menu buttons reopen the current inline panel instead of reaching the AI as prompts", () => {
  for (const text of [
    "🎮 بازی‌ها", "🤖 هوش مصنوعی", "👤 پنل شخصی", "👥 مدیریت گروه",
    "🏆 رتبه‌بندی", "🚀 چالش روزانه", "➕ افزودن به گروه",
    "🧠 کوئیز روزانه", "🎲 جرئت یا حقیقت", "✊ سنگ کاغذ قیچی",
    "🔤 حدس کلمه", "📊 ساخت نظرسنجی", "⬅️ برگشت به پنل",
  ]) {
    assert.equal(classifyLegacyKeyboardUpdate(update(text)), "reopen", text);
  }
});

test("the old close button is consumed and removes the persistent keyboard", () => {
  assert.equal(classifyLegacyKeyboardUpdate(update("بستن پنل ❌")), "close");
  assert.equal(classifyLegacyKeyboardUpdate(update("❌ بستن منو")), "close");
});

test("ordinary messages and callback-only updates are untouched", () => {
  assert.equal(classifyLegacyKeyboardUpdate(update("سلام شاکی خوبی؟")), "none");
  assert.equal(classifyLegacyKeyboardUpdate(update("مدیریت گروه من را توضیح بده")), "none");
  assert.equal(classifyLegacyKeyboardUpdate({ callback_query: { data: "home:close" } }), "none");
  assert.equal(classifyLegacyKeyboardUpdate(update("/start", "not-a-number")), "none");
});

test("keyboard removal uses Telegram ReplyKeyboardRemove and deletes its invisible notice", async () => {
  const calls = [];
  await removeLegacyReplyKeyboard(123, async (method, params) => {
    calls.push({ method, params });
    return method === "sendMessage" ? { message_id: 77 } : {};
  });
  assert.equal(calls.length, 2);
  assert.equal(calls[0].method, "sendMessage");
  assert.deepEqual(calls[0].params.reply_markup, { remove_keyboard: true });
  assert.equal(calls[0].params.text, "\u2063");
  assert.deepEqual(calls[1], { method: "deleteMessage", params: { chat_id: 123, message_id: 77 } });
});
