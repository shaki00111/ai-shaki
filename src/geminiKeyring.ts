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
