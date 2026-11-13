/** Provider-specific cooldowns for TTS keys.
 * Gemini chat and Gemini TTS can have different model quotas. A chat-model
 * 429 must not make the same API key unusable for the independent TTS model.
 * This registry is intentionally isolate-local and separate from the shared
 * disabled_api_keys map used by ordinary chat/image providers.
 */
export class ProviderKeyCooldowns {
  private readonly disabledUntil = new Map<string, number>();
  constructor(private readonly now: () => number = Date.now) {}
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
