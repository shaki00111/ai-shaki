export type LegacyKeyboardDecision = "none" | "clear" | "reopen" | "close";

export type LegacyKeyboardUpdate = {
  message?: {
    text?: string;
    chat?: { id?: number; type?: string };
  };
  callback_query?: {
    data?: string;
    message?: { chat?: { id?: number } };
  };
};

const LEGACY_MENU_LABELS = new Set([
  "بازی ها",
  "هوش مصنوعی",
  "پنل شخصی",
  "مدیریت گروه",
  "رتبه بندی",
  "چالش روزانه",
  "افزودن به گروه",
  "کوئیز روزانه",
  "جرئت یا حقیقت",
  "سنگ کاغذ قیچی",
  "حدس کلمه",
  "ساخت نظرسنجی",
  "برگشت به پنل",
]);

function normalizeLabel(value: string): string {
  return value.normalize("NFKC")
    .replace(/\u200c/g, " ")
    .replace(/[\u200b\u200d-\u200f\uFEFF]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase();
}

/** Detects stale ReplyKeyboard buttons without touching ordinary user messages. */
export function classifyLegacyKeyboardUpdate(update: LegacyKeyboardUpdate): LegacyKeyboardDecision {
  const callback = update?.callback_query;
  if (callback?.data === "home:close") {
    const callbackChatId = callback.message?.chat?.id;
    return typeof callbackChatId === "number" && Number.isSafeInteger(callbackChatId) ? "clear" : "none";
  }

  const message = update?.message;
  if (!message || typeof message.chat?.id !== "number" || !Number.isSafeInteger(message.chat.id)) return "none";
  const text = String(message.text ?? "").trim();
  if (!text) return "none";

  const command = text.split(/\s+/, 1)[0].toLowerCase().replace(/@[^@]+$/, "");
  if (["/start", "/panel", "/keyboard", "/keypanel"].includes(command) || normalizeLabel(text) === "پنل") {
    return "clear";
  }

  const label = normalizeLabel(text);
  if (label === "بستن پنل" || label === "بستن منو") return "close";
  return LEGACY_MENU_LABELS.has(label) ? "reopen" : "none";
}

export type TelegramCall = (method: string, params: Record<string, unknown>) => Promise<any>;

/**
 * Telegram ReplyKeyboardMarkup is persistent on the client. Send a tiny
 * invisible message with ReplyKeyboardRemove, then delete that message so the
 * user sees only the real inline panel.
 */
export async function removeLegacyReplyKeyboard(chatId: number, call: TelegramCall): Promise<void> {
  const sent = await call("sendMessage", {
    chat_id: chatId,
    text: "\u2063",
    disable_notification: true,
    reply_markup: { remove_keyboard: true },
  });
  if (typeof sent?.message_id === "number") {
    await call("deleteMessage", { chat_id: chatId, message_id: sent.message_id }).catch(() => {});
  }
}
