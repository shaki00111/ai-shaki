/* Gemini cooldowns: opaque per-key records, atomic monotonic writes and a
 * compare-and-swap migration of the legacy JSON map. No secret is written into
 * the new key or value; a SHA-256 fingerprint is not a password hash. */
interface Statement {
  bind(...args: unknown[]): { run(): Promise<{ meta?: unknown }>; all<T>(): Promise<{ results?: T[] }> };
}
export interface CooldownDB { prepare(sql: string): Statement }
const PREFIX = "gemini:cooldown:v2:";
const LEGACY = "disabled_api_keys";
const MAX_LEGACY_KEYS = 200;

export async function cooldownId(key: string): Promise<string> {
  if (!key || key.length > 512) throw new Error("Invalid cooldown key");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(key));
  return PREFIX + Array.from(new Uint8Array(digest), n => n.toString(16).padStart(2, "0")).join("");
}

/** Never shorten a cooldown written concurrently by another Worker isolate. */
export async function persistCooldown(db: CooldownDB, key: string, until: number, now = Date.now()): Promise<void> {
  if (!Number.isSafeInteger(until) || until <= now || !Number.isSafeInteger(now)) throw new Error("Invalid cooldown expiry");
  const id = await cooldownId(key);
  await db.prepare(`INSERT INTO kv_store (key,value_text,value_blob,expires_at,created_at)
    VALUES (?,?,NULL,?,?) ON CONFLICT(key) DO UPDATE SET
    value_text=CAST(MAX(CAST(kv_store.value_text AS INTEGER),CAST(excluded.value_text AS INTEGER)) AS TEXT),
    expires_at=MAX(COALESCE(kv_store.expires_at,0),excluded.expires_at),value_blob=NULL`)
    .bind(id, String(until), Math.ceil(until / 1000), Math.floor(now / 1000)).run();
}

/** Indexed bulk read, one query irrespective of the configured key count. */
export async function readCooldowns(db: CooldownDB, keys: readonly string[], now = Date.now()): Promise<Record<string, number>> {
  const unique = [...new Set(keys.filter(key => key && key.length <= 512))];
  if (!unique.length) return {};
  const ids = await Promise.all(unique.map(cooldownId));
  const positions = new Map(ids.map((id, i) => [id, unique[i]]));
  const result: Record<string, number> = Object.create(null);
  // Stay below D1's parameter limit even for large managed keyrings.
  for (let offset = 0; offset < ids.length; offset += 90) {
    const chunk = ids.slice(offset, offset + 90);
    const rows = await db.prepare(`SELECT key,value_text FROM kv_store WHERE key IN (${chunk.map(() => "?").join(",")}) AND (expires_at IS NULL OR expires_at>?)`)
      .bind(...chunk, Math.floor(now / 1000)).all<{ key: string; value_text: string | null }>();
    for (const row of rows.results ?? []) {
      const key = positions.get(row.key), until = Number(row.value_text);
      if (key && Number.isSafeInteger(until) && until > now) result[key] = until;
    }
  }
  return result;
}

/** Persist legacy entries first; clear the exact old snapshot only after success.
 * Concurrent legacy writes change the snapshot and are retried on a later read. */
export async function migrateLegacyCooldowns(db: CooldownDB, raw: string, now = Date.now()): Promise<void> {
  const value: unknown = JSON.parse(raw);
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid legacy cooldown map");
  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length > MAX_LEGACY_KEYS) throw new Error("Legacy cooldown map exceeds migration limit");
  for (const [key, expiry] of entries) {
    if (!key || key.length > 512 || typeof expiry !== "number" || !Number.isSafeInteger(expiry)) throw new Error("Invalid legacy cooldown entry");
  }
  for (const [key, expiry] of entries) {
    if ((expiry as number) <= now) continue;
    const until = expiry as number;
    const id = await cooldownId(key);
    // Only copy while the source snapshot still exists. This prevents a delayed
    // migration from recreating cooldowns after an owner reset or newer write.
    await db.prepare(`INSERT INTO kv_store (key,value_text,value_blob,expires_at,created_at)
      SELECT ?,?,NULL,?,? WHERE EXISTS(SELECT 1 FROM kv_store WHERE key=? AND value_text=?)
      ON CONFLICT(key) DO UPDATE SET
      value_text=CAST(MAX(CAST(kv_store.value_text AS INTEGER),CAST(excluded.value_text AS INTEGER)) AS TEXT),
      expires_at=MAX(COALESCE(kv_store.expires_at,0),excluded.expires_at),value_blob=NULL`)
      .bind(id, String(until), Math.ceil(until / 1000), Math.floor(now / 1000), LEGACY, raw).run();
  }
  await db.prepare("UPDATE kv_store SET value_text='{}' WHERE key=? AND value_text=?").bind(LEGACY, raw).run();
}

/** Owner reset clears both versions with one atomic statement. */
export async function clearCooldowns(db: CooldownDB): Promise<void> {
  await db.prepare("DELETE FROM kv_store WHERE key=? OR (key>=? AND key<?)").bind(LEGACY, PREFIX, PREFIX + "\uffff").run();
}
