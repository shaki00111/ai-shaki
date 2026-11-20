import test from "node:test";
import assert from "node:assert/strict";
import {
  handleTelegramKeyboardUpdate, isKeyboardCommand, isGroupAdminStatus, rpsWinner,
  maybeHandleKeyboardWebhook,
} from "../src/telegramKeyboard.ts";

test("keyboard commands accept aliases and bot-addressed commands", () => {
  for (const command of ["/panel", "/keyboard", "/keypanel", "/panel@AI_SHAKI_BOT", "پنل", "⌨️ پنل کیبوردی"]) {
    assert.equal(isKeyboardCommand(command), true, command);
  }
  assert.equal(isKeyboardCommand("/start"), false);
});

test("group admin checks accept only administrator and creator roles", () => {
  assert.equal(isGroupAdminStatus("administrator"), true);
  assert.equal(isGroupAdminStatus("creator"), true);
  for (const status of ["member", "restricted", "left", "kicked", ""]) assert.equal(isGroupAdminStatus(status), false);
});

test("rock paper scissors resolves all outcomes", () => {
  assert.equal(rpsWinner("سنگ", "قیچی"), "win");
  assert.equal(rpsWinner("کاغذ", "سنگ"), "win");
  assert.equal(rpsWinner("قیچی", "کاغذ"), "win");
  assert.equal(rpsWinner("سنگ", "کاغذ"), "lose");
  assert.equal(rpsWinner("سنگ", "سنگ"), "draw");
});

test("the main keyboard is a real Telegram ReplyKeyboardMarkup", async () => {
  const calls = [];
  const handled = await handleTelegramKeyboardUpdate({
    message: { message_id: 4, text: "/panel", chat: { id: -100123, type: "supergroup" }, from: { id: 10, first_name: "Arman" } },
  }, { TOKEN: "test" }, async (method, params) => { calls.push({ method, params }); return {}; });
  assert.equal(handled, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, "sendMessage");
  const markup = calls[0].params.reply_markup;
  assert.equal(markup.resize_keyboard, true);
  assert.equal(markup.is_persistent, true);
  assert.ok(markup.keyboard.flat().some(button => button.text === "🎮 بازی‌ها"));
  assert.ok(markup.keyboard.flat().some(button => button.text === "➕ افزودن به گروه"));
});

test("invite button opens Telegram's real add-to-group deep link", async () => {
  const calls = [];
  await handleTelegramKeyboardUpdate({
    message: { message_id: 5, text: "➕ افزودن به گروه", chat: { id: 5, type: "private" }, from: { id: 5 } },
  }, { TOKEN: "test" }, async (method, params) => { calls.push({ method, params }); return {}; });
  assert.equal(calls[0].method, "sendMessage");
  assert.equal(calls[0].params.reply_markup.inline_keyboard[0][0].url, "https://t.me/AI_SHAKI_BOT?startgroup=true");
});

test("group management denies members and checks Telegram admin status", async () => {
  const calls = [];
  await handleTelegramKeyboardUpdate({
    message: { message_id: 6, text: "👥 مدیریت گروه", chat: { id: -1001, type: "supergroup" }, from: { id: 55 } },
  }, { TOKEN: "test" }, async (method, params) => {
    calls.push({ method, params });
    if (method === "getChatMember") return { status: "member" };
    return {};
  });
  assert.ok(calls.some(call => call.method === "getChatMember"));
  assert.match(calls.at(-1).params.text, /فقط برای مدیران/);
});

test("group management opens for verified admins", async () => {
  const calls = [];
  await handleTelegramKeyboardUpdate({
    message: { message_id: 7, text: "👥 مدیریت گروه", chat: { id: -1001, type: "supergroup" }, from: { id: 55 } },
  }, { TOKEN: "test" }, async (method, params) => {
    calls.push({ method, params });
    if (method === "getChatMember") return { status: "administrator" };
    return {};
  });
  assert.ok(calls.at(-1).params.text.includes("/promo on"));
});

test("game buttons invoke native Telegram poll and interactive callback keyboards", async () => {
  const calls = [];
  await handleTelegramKeyboardUpdate({
    message: { message_id: 8, text: "🧠 کوئیز روزانه", chat: { id: -1001, type: "supergroup" }, from: { id: 55 } },
  }, { TOKEN: "test" }, async (method, params) => { calls.push({ method, params }); return {}; });
  assert.equal(calls[0].method, "sendPoll");
  assert.equal(calls[0].params.type, "quiz");
  calls.length = 0;
  await handleTelegramKeyboardUpdate({
    message: { message_id: 9, text: "✊ سنگ کاغذ قیچی", chat: { id: -1001, type: "supergroup" }, from: { id: 55 } },
  }, { TOKEN: "test" }, async (method, params) => { calls.push({ method, params }); return {}; });
  assert.ok(calls[0].params.reply_markup.inline_keyboard[0].every(button => button.callback_data.startsWith("shaki:rps:")));
});

test("truth or dare callback answers and sends a prompt", async () => {
  const calls = [];
  const handled = await handleTelegramKeyboardUpdate({
    callback_query: { id: "cb1", data: "shaki:truth", from: { id: 4 }, message: { message_id: 2, chat: { id: -1001, type: "supergroup" } } },
  }, { TOKEN: "test" }, async (method, params) => { calls.push({ method, params }); return {}; });
  assert.equal(handled, true);
  assert.ok(calls.some(call => call.method === "answerCallbackQuery"));
  assert.ok(calls.some(call => call.method === "sendMessage" && call.params.text.includes("🧠 حقیقت")));
});

test("webhook interception requires Telegram's configured secret header", async () => {
  const body = JSON.stringify({ message: { message_id: 1, text: "/panel", chat: { id: 7, type: "private" }, from: { id: 7 } } });
  const denied = await maybeHandleKeyboardWebhook(new Request("https://worker.example/hook", { method: "POST", headers: { "content-type": "application/json" }, body }), { TOKEN: "t", WEBHOOK_SECRET: "secret" });
  assert.equal(denied, null);
  const accepted = await maybeHandleKeyboardWebhook(new Request("https://worker.example/hook", { method: "POST", headers: { "content-type": "application/json", "X-Telegram-Bot-Api-Secret-Token": "secret" }, body }), { TOKEN: "t", WEBHOOK_SECRET: "secret" });
  assert.equal(accepted?.status, 200);
});
