/** Telegram membership transitions used to avoid duplicate group onboarding messages. */
export interface TelegramMemberStatus { status: string; is_member?: boolean; }
export function isTelegramMemberPresent(member?: TelegramMemberStatus | null): boolean {
  if (!member) return false;
  return ["member", "administrator", "creator"].includes(member.status)
    || (member.status === "restricted" && member.is_member !== false);
}
export function shouldSendGroupOnboarding(oldMember: TelegramMemberStatus | null | undefined, newMember: TelegramMemberStatus): boolean {
  return isTelegramMemberPresent(newMember) && !isTelegramMemberPresent(oldMember);
}
