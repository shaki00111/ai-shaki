const OWNER_QUESTION_PATTERNS: RegExp[] = [
  /(?:بابا|پدر)(?:ت|ی)?\s*(?:کیه|کیست|چه\s*کسیه|چه\s*کسی\s*است)/iu,
  /(?:مالک|صاحب)(?:ت|تو|ربات)?\s*(?:کیه|کیست|چه\s*کسی|کی)/iu,
  /(?:سازنده|خالق)(?:ت|\s*ات|\s*ی)?\s*(?:کیه|کیست|چه\s*کسی|کی)/iu,
  /(?:کی|چه\s*کسی)\s*(?:تو\s*رو\s*)?(?:ساختت|ساخته|طراحی\s*کرده|خلق\s*کرده)/iu,
  /who\s+(?:made|created|built|owns?)\s+you|who\s+is\s+your\s+(?:owner|creator|maker|developer)/iu,
];

export function isOwnerIdentityQuestion(input: string): boolean {
  const text = String(input ?? "").normalize("NFKC").replace(/[\u200b-\u200f\u202a-\u202e]/g, "").replace(/[ي]/g, "ی").replace(/[ك]/g, "ک").replace(/\s+/g, " ").trim();
  return Boolean(text && text.length <= 500 && OWNER_QUESTION_PATTERNS.some(pattern => pattern.test(text)));
}

export function ownerIdentityReply(input: string): string | null {
  if (!isOwnerIdentityQuestion(input)) return null;
  const text = input.toLowerCase();
  if (/\b(?:who|made|created|built|owns?|developer)\b/.test(text)) return "🤖 I’m AI SHAKI. My creator and owner is @SHAKI0030.";
  if (/(?:بابا|پدر)/u.test(input)) return "😄 من یه هوش مصنوعی‌ام و بابای واقعی ندارم؛ ولی سازنده و صاحبم @SHAKI0030 هست.";
  if (/(?:سازنده|سازند|خالق|ساختت|ساخته|طراحی)/u.test(input)) return "⚡ من، AI SHAKI، توسط @SHAKI0030 ساخته و مدیریت می‌شم.";
  return "👑 صاحب و مالک AI SHAKI، @SHAKI0030 هست.";
}
