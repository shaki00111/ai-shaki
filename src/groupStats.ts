/** Persistent per-group XP and leaderboard backed by the existing D1 kv_store table. */
export interface GroupStatsDB {
  prepare(sql: string): {
    bind(...values: unknown[]): {
      run(): Promise<{ meta?: { changes?: number } }>;
      first<T>(): Promise<T | null>;
      all<T>(): Promise<{ results?: T[] }>;
    };
  };
}

export interface GroupPlayerScore {
  userId: number;
  xp: number;
}

const PREFIX = "shaki:group-xp:v1:";
const MAX_XP_PER_EVENT = 100;

function assertGroupId(chatId: number): void {
  if (!Number.isSafeInteger(chatId) || chatId >= 0) throw new Error("A Telegram group chat id is required");
}
function assertUserId(userId: number): void {
  if (!Number.isSafeInteger(userId) || userId <= 0) throw new Error("A valid Telegram user id is required");
}
function scoreKey(chatId: number, userId: number): string {
  assertGroupId(chatId);
  assertUserId(userId);
  return `${PREFIX}${chatId}:user:${userId}`;
}
function groupRange(chatId: number): [string, string] {
  assertGroupId(chatId);
  const prefix = `${PREFIX}${chatId}:user:`;
  return [prefix, prefix + "\\uffff"];
}

/**
 * Award XP exactly once per event id. The NOT EXISTS guard and upsert happen
 * in one SQLite statement, so webhook retries cannot double-award a game.
 */
export async function awardGroupXp(
  db: GroupStatsDB,
  chatId: number,
  userId: number,
  amount: number,
  eventId: string,
  now = Date.now(),
): Promise<{ awarded: boolean; xp: number }> {
  const key = scoreKey(chatId, userId);
  if (!Number.isSafeInteger(amount) || amount < 1 || amount > MAX_XP_PER_EVENT) throw new Error("Invalid XP amount");
  const event = String(eventId).trim();
  if (!event || event.length > 160 || /[\\u0000-\\u001f]/.test(event)) throw new Error("Invalid event id");
  if (!Number.isFinite(now)) throw new Error("Invalid timestamp");
  const eventKey = `${PREFIX}${chatId}:event:${event}`;
  const createdAt = Math.floor(now / 1000);
  const result = await db.prepare(`INSERT INTO kv_store (key,value_text,value_blob,expires_at,created_at)
    SELECT ?, CAST(COALESCE((SELECT CAST(value_text AS INTEGER) FROM kv_store WHERE key=?),0)+? AS TEXT), NULL,NULL,?
    WHERE NOT EXISTS (SELECT 1 FROM kv_store WHERE key=?)
    ON CONFLICT(key) DO UPDATE SET
      value_text=CAST(CAST(COALESCE(kv_store.value_text,'0') AS INTEGER)+? AS TEXT),
      created_at=excluded.created_at`)
    .bind(key, key, amount, createdAt, eventKey, amount).run();
  const row = await db.prepare("SELECT value_text FROM kv_store WHERE key=?").bind(key).first<{ value_text: string | null }>();
  const xp = Math.max(0, Number.parseInt(String(row?.value_text ?? "0"), 10) || 0);
  return { awarded: Number(result.meta?.changes ?? 0) > 0, xp };
}

export async function getGroupPlayerScore(db: GroupStatsDB, chatId: number, userId: number): Promise<number> {
  const row = await db.prepare("SELECT value_text FROM kv_store WHERE key=?").bind(scoreKey(chatId, userId)).first<{ value_text: string | null }>();
  return Math.max(0, Number.parseInt(String(row?.value_text ?? "0"), 10) || 0);
}

export async function getGroupLeaderboard(db: GroupStatsDB, chatId: number, limit = 10): Promise<GroupPlayerScore[]> {
  const [start, end] = groupRange(chatId);
  const safeLimit = Number.isSafeInteger(limit) ? Math.max(1, Math.min(20, limit)) : 10;
  const result = await db.prepare(`SELECT key,value_text FROM kv_store
    WHERE key>=? AND key<? ORDER BY CAST(value_text AS INTEGER) DESC,key ASC LIMIT ?`)
    .bind(start, end, safeLimit).all<{ key: string; value_text: string | null }>();
  return (result.results ?? []).flatMap(row => {
    const match = /^-?\\d+$/.exec(row.key.slice(start.length));
    if (!match) return [];
    const xp = Number.parseInt(String(row.value_text ?? "0"), 10);
    if (!Number.isSafeInteger(xp) || xp < 0) return [];
    return [{ userId: Number(match[0]), xp }];
  });
}
