/** Persistent, group-isolated XP ledger backed by the existing D1 kv_store table. */
export interface GroupStatsDB {
  prepare(sql: string): {
    bind(...values: unknown[]): {
      run(): Promise<{ meta?: { changes?: number } }>;
      first<T>(): Promise<T | null>;
      all<T>(): Promise<{ results?: T[] }>;
    };
  };
}
export interface GroupPlayerScore { userId: number; xp: number; }
const PREFIX = "shaki:group-xp:v1:";
const MAX_XP_PER_EVENT = 100;
function assertGroupId(chatId: number): void {
  if (!Number.isSafeInteger(chatId) || chatId >= 0) throw new Error("A Telegram group chat id is required");
}
function assertUserId(userId: number): void {
  if (!Number.isSafeInteger(userId) || userId <= 0) throw new Error("A valid Telegram user id is required");
}
function eventPrefix(chatId: number): string {
  assertGroupId(chatId);
  return `${PREFIX}${chatId}:event:`;
}
function eventKey(chatId: number, userId: number, eventId: string): string {
  assertUserId(userId);
  const event = String(eventId).trim();
  if (!event || event.length > 120 || /[\u0000-\u001f]/.test(event) || event.includes(":")) throw new Error("Invalid event id");
  return `${eventPrefix(chatId)}${userId}:${event}`;
}
/** The unique event row itself is the ledger entry: duplicate Telegram retries cannot award twice. */
export async function awardGroupXp(
  db: GroupStatsDB, chatId: number, userId: number, amount: number, eventId: string, now = Date.now(),
): Promise<{ awarded: boolean; xp: number }> {
  if (!Number.isSafeInteger(amount) || amount < 1 || amount > MAX_XP_PER_EVENT) throw new Error("Invalid XP amount");
  if (!Number.isFinite(now)) throw new Error("Invalid timestamp");
  const key = eventKey(chatId, userId, eventId);
  const result = await db.prepare(`INSERT INTO kv_store (key,value_text,value_blob,expires_at,created_at)
    VALUES (?, ?, NULL, NULL, ?)
    ON CONFLICT(key) DO NOTHING`).bind(key, String(amount), Math.floor(now / 1000)).run();
  const xp = await getGroupPlayerScore(db, chatId, userId);
  return { awarded: Number(result.meta?.changes ?? 0) > 0, xp };
}
export async function getGroupPlayerScore(db: GroupStatsDB, chatId: number, userId: number): Promise<number> {
  assertUserId(userId);
  const prefix = `${eventPrefix(chatId)}${userId}:`;
  const row = await db.prepare(`SELECT COALESCE(SUM(CAST(value_text AS INTEGER)),0) AS xp
    FROM kv_store WHERE key>=? AND key<?`).bind(prefix, prefix + "\uffff").first<{ xp: number | string }>();
  return Math.max(0, Number(row?.xp ?? 0) || 0);
}
export async function getGroupLeaderboard(db: GroupStatsDB, chatId: number, limit = 10): Promise<GroupPlayerScore[]> {
  const prefix = eventPrefix(chatId);
  const safeLimit = Number.isSafeInteger(limit) ? Math.max(1, Math.min(20, limit)) : 10;
  const result = await db.prepare(`SELECT key,value_text FROM kv_store
    WHERE key>=? AND key<? ORDER BY created_at DESC`).bind(prefix, prefix + "\uffff").all<{key:string;value_text:string|null}>();
  const scores = new Map<number, number>();
  for (const row of result.results ?? []) {
    const match = /^([1-9]\d*):/.exec(row.key.slice(prefix.length));
    if (!match) continue;
    const userId = Number(match[1]);
    const amount = Number.parseInt(String(row.value_text ?? "0"), 10);
    if (!Number.isSafeInteger(userId) || !Number.isSafeInteger(amount) || amount < 0) continue;
    scores.set(userId, (scores.get(userId) ?? 0) + amount);
  }
  return [...scores].map(([userId,xp])=>({userId,xp})).sort((a,b)=>b.xp-a.xp || a.userId-b.userId).slice(0,safeLimit);
}
