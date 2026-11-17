export interface PollDraft {
  question: string;
  options: string[];
}

/** Telegram's regular anonymous poll: question | option 1 | option 2 ... */
export function parsePollDraft(input: string): PollDraft | null {
  const parts = input.split("|").map(part => part.trim());
  if (parts.length < 3 || parts.length > 11) return null;
  const [question, ...options] = parts;
  // UTF-16 length is conservative for astral emoji and stays within API limits.
  if (!question || question.length > 300 || options.some(option => !option || option.length > 100)) return null;
  if (new Set(options.map(option => option.normalize("NFKC").toLocaleLowerCase("en-US"))).size !== options.length) return null;
  return { question, options };
}

/** Dependency injection keeps the actual Telegram payload directly testable. */
export async function sendAnonymousPoll(
  send: (method: string, params: Record<string, unknown>) => Promise<unknown>,
  chatId: number,
  replyTo: number,
  draft: PollDraft,
): Promise<void> {
  await send("sendPoll", {
    chat_id: chatId,
    question: draft.question,
    options: draft.options.map(text => ({ text })),
    is_anonymous: true,
    allows_multiple_answers: false,
    reply_to_message_id: replyTo,
  });
}
