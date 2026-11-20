/** Build the active pool from authoritative configuration, never a stale cached pool. */
export function mergeGeminiKeys(environmentKeys: readonly (string | undefined)[], managed: readonly { key: string; enabled: boolean }[]): string[] {
  return [...new Set([
    ...environmentKeys.filter((key): key is string => Boolean(key)),
    ...managed.filter(item => item.enabled && item.key).map(item => item.key),
  ])];
}

export function hasGeminiKeyAfterUpdate(environmentKeys: readonly (string | undefined)[], managed: readonly { key: string; enabled: boolean }[]): boolean {
  return mergeGeminiKeys(environmentKeys, managed).length > 0;
}

/** Read numbered Cloudflare Gemini secrets in numeric order (supports up to 100 keys). */
export function numberedGeminiKeysFromEnv(env: Record<string, unknown>, maxKeys = 100): (string | undefined)[] {
  const keys: string[] = [];
  const limit = Number.isInteger(maxKeys) ? Math.max(1, Math.min(100, maxKeys)) : 100;
  for (let index = 1; index <= limit; index++) {
    const value = env["GEMINI_KEY_" + index];
    if (typeof value === "string" && value.trim()) keys.push(value.trim());
  }
  return keys;
}
