/** Temporary public-facing notice while SHAKI is being updated. */
export const MAINTENANCE_NOTICE_TEXT = [
  "🛠️ در حال بروزرسانی",
  "",
  "نوا در حال به‌روزرسانی است و الان پاسخ نمی‌دهد. چند دقیقه‌ی دیگر دوباره امتحان کن.",
].join("\n");

interface MaintenanceNoticeInput {
  chatType: string;
  text?: string;
  caption?: string;
  entities?: Array<{ type: string; offset: number; length: number; user?: { id: number } }>;
  replyToBot: boolean;
  botId?: number;
  botUsername?: string;
}

/** Private chats always get the notice; groups only when SHAKI is addressed. */
export function shouldSendMaintenanceNotice(input: MaintenanceNoticeInput): boolean {
  if (input.chatType === "private") return true;
  if (input.chatType !== "group" && input.chatType !== "supergroup") return false;
  if (input.replyToBot) return true;

  if (input.botId && input.entities?.some(entity =>
    entity.type === "text_mention" && entity.user?.id === input.botId
  )) return true;

  const username = (input.botUsername || "AI_SHAKI_BOT").replace(/^@/, "");
  const body = `${input.text ?? ""}\n${input.caption ?? ""}`;
  const safeUsername = username.replace(/[^a-z0-9_]/gi, "");
  return safeUsername.length > 0 && body.toLowerCase().includes(`@${safeUsername.toLowerCase()}`);
}
