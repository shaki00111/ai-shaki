/** Shared policy for Gemini key failover and private group diagnostics. */
export const GEMINI_KEY_RETRY_DELAY_MS = 5_000;

export const GROUP_SERVER_STUCK_NOTICE =
  "⚠️ سرور فعلاً گیر کرده؛ جزئیات خطا فقط برای مالک ربات به‌صورت خصوصی ارسال می‌شود. کمی بعد دوباره امتحان کن.";

/** Telegram private user chat IDs are positive; group/supergroup IDs are negative. */
export function isGroupChatId(chatId: number): boolean {
  return Number.isFinite(chatId) && chatId < 0;
}
