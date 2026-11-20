/** Bound immediate quota failover to the number of configured keys. */
export function shouldRetryGeminiQuotaImmediately(
  message: string,
  action: string,
  insertedRetries: number,
  configuredKeys: number,
  hasEligibleKey: boolean,
): boolean {
  return action === "nextKey"
    && /gemini_quota|quota|resource_exhausted|rate.?limit|\b429\b/i.test(message)
    && insertedRetries < Math.max(0, configuredKeys - 1)
    && hasEligibleKey;
}

/** Select an eligible key without bypassing cooldowns; return -1 if none remain. */
export function selectGeminiKeyIndex(
  keys: string[],
  disabledUntil: Record<string, number>,
  lastUsedAt: Map<string, number>,
  now: number,
  preferredStart = 0,
  excludedKeys: ReadonlySet<string> = new Set(),
): number {
  if (!keys.length) return -1;
  const start = ((preferredStart % keys.length) + keys.length) % keys.length;
  let bestIndex = -1;
  let bestUsedAt = Infinity;

  for (let offset = 0; offset < keys.length; offset++) {
    const index = (start + offset) % keys.length;
    const key = keys[index];
    if (excludedKeys.has(key) || (disabledUntil[key] ?? 0) > now) continue;

    const usedAt = lastUsedAt.get(key) ?? 0;
    if (usedAt < bestUsedAt) {
      bestUsedAt = usedAt;
      bestIndex = index;
    }
  }

  return bestIndex;
}
