/** Provider-specific cooldowns for TTS keys.
 * Gemini chat and Gemini TTS can have different model quotas. A chat-model
 * 429 must not make the same API key unusable for the independent TTS model.
 * This registry is intentionally isolate-local and separate from the shared
 * disabled_api_keys map used by ordinary chat/image providers.
 */
export class ProviderKeyCooldowns {
  private readonly disabledUntil = new Map<string, number>();
  private readonly now: () => number;
  constructor(now: () => number = Date.now) { this.now = now; }
  isDisabled(key: string): boolean {
    const until = this.disabledUntil.get(key);
    if (!until) return false;
    if (until <= this.now()) { this.disabledUntil.delete(key); return false; }
    return true;
  }
  disable(key: string, durationMs: number): void {
    if (!key || !Number.isFinite(durationMs) || durationMs <= 0) return;
    const until = this.now() + Math.max(1_000, durationMs);
    this.disabledUntil.set(key, Math.max(this.disabledUntil.get(key) ?? 0, until));
  }
  remainingMs(key: string): number {
    return Math.max(0, (this.disabledUntil.get(key) ?? 0) - this.now());
  }
}
export const ttsKeyCooldowns = new ProviderKeyCooldowns();


/** Independent cooldown pool for ElevenLabs; never shares Gemini key state. */
export const elevenLabsKeyCooldowns = new ProviderKeyCooldowns();

/** Parse Retry-After as seconds or an HTTP date, with bounded safe defaults. */
export function retryAfterDurationMs(
  value: string | null,
  now = Date.now(),
  fallbackMs = 90_000,
  maxMs = 60 * 60_000,
): number {
  if (!value?.trim()) return fallbackMs;
  const raw = value.trim();
  const seconds = Number(raw);
  const delay = Number.isFinite(seconds) && raw !== ""
    ? seconds * 1000
    : Date.parse(raw) - now;
  if (!Number.isFinite(delay) || delay <= 0) return fallbackMs;
  return Math.max(1_000, Math.min(maxMs, delay));
}

/** Only treat a provider response as audio when it explicitly declares an audio MIME type. */
export function isAudioContentType(value: string | null): boolean {
  return typeof value === "string" && /^audio\/[a-z0-9.+-]+(?:\s*;|$)/i.test(value.trim());
}

export interface TelegramAudioDeliveryAttempt {
  method: "sendVoice" | "sendAudio" | "sendDocument";
  field: "voice" | "audio" | "document";
  fileName: string;
  mimeType: string;
}

/** Detect common audio containers from their file signatures, not provider labels alone. */
export function detectAudioMimeType(bytes: Uint8Array): string | null {
  if (bytes.length >= 12 && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) {
    return "audio/wav";
  }
  if (bytes.length >= 4 && bytes[0] === 0x4f && bytes[1] === 0x67 && bytes[2] === 0x67 && bytes[3] === 0x53) {
    return "audio/ogg";
  }
  if (bytes.length >= 3 && bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) {
    return "audio/mpeg";
  }
  // MP3 frames may omit an ID3 tag and begin directly with the frame sync word.
  for (let i = 0; i < Math.min(bytes.length - 1, 8); i++) {
    if (bytes[i] === 0xff && (bytes[i + 1] & 0xe0) === 0xe0) return "audio/mpeg";
  }
  return null;
}

/** Preferred Telegram upload followed by safe compatibility fallbacks. */
export function getTelegramAudioDeliveryPlan(format: boolean | string): TelegramAudioDeliveryAttempt[] {
  const mime = typeof format === "boolean" ? (format ? "audio/wav" : "audio/mpeg") : format.toLowerCase().split(";")[0].trim();
  if (mime === "audio/wav" || mime === "audio/x-wav" || mime === "audio/wave") {
    return [
      { method: "sendAudio", field: "audio", fileName: "voice.wav", mimeType: "audio/wav" },
      { method: "sendDocument", field: "document", fileName: "voice.wav", mimeType: "audio/wav" },
    ];
  }
  if (mime === "audio/ogg" || mime === "application/ogg") {
    return [
      { method: "sendVoice", field: "voice", fileName: "voice.ogg", mimeType: "audio/ogg" },
      { method: "sendAudio", field: "audio", fileName: "voice.ogg", mimeType: "audio/ogg" },
      { method: "sendDocument", field: "document", fileName: "voice.ogg", mimeType: "audio/ogg" },
    ];
  }
  return [
    { method: "sendVoice", field: "voice", fileName: "voice.mp3", mimeType: "audio/mpeg" },
    { method: "sendAudio", field: "audio", fileName: "voice.mp3", mimeType: "audio/mpeg" },
    { method: "sendDocument", field: "document", fileName: "voice.mp3", mimeType: "audio/mpeg" },
  ];
}
