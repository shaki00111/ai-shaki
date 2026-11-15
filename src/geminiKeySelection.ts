/**
 * Select an eligible Gemini key without bypassing its cooldown.
 * Returns -1 when every configured key is disabled; callers may then use
 * an explicitly supported fallback instead of retrying a benched credential.
 */
export function selectGeminiKeyIndex(
  keys: string[],
  disabledUntil: Record<string, number>,
  lastUsedAt: Map<string, number>,
  now: number,
  preferredStart = 0,
): number {
  if (!keys.length) return -1;
  const start = ((preferredStart % keys.length) + keys.length) % keys.length;
  let bestIndex = -1;
  let bestUsedAt = Infinity;

  for (let offset = 0; offset < keys.length; offset++) {
    const index = (start + offset) % keys.length;
    const key = keys[index];
    if ((disabledUntil[key] ?? 0) > now) continue;

    const usedAt = lastUsedAt.get(key) ?? 0;
    if (usedAt < bestUsedAt) {
      bestUsedAt = usedAt;
      bestIndex = index;
    }
  }

  return bestIndex;
}
