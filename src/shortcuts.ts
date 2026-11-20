/** Private per-user text shortcuts, stored individually in D1-backed kv_store. */
export interface ShortcutDB {
  prepare(sql: string): {
    bind(...values: unknown[]): {
      run(): Promise<{ meta?: unknown }>;
      first<T>(): Promise<T | null>;
      all<T>(): Promise<{ results?: T[] }>;
    };
  };
}
export const MAX_SHORTCUTS = 20;
const PREFIX = "shortcut:v1:";

export function shortcutName(value: string): string | null {
  const name = value.trim().toLowerCase();
  return /^[a-z][a-z0-9_]{0,23}$/.test(name) ? name : null;
}

export function shortcutText(value: string): string | null {
  const text = value.trim();
  if (!text || text.length > 1000 || text.startsWith("/") || /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(text)) return null;
  return text;
}

export type ShortcutAction = { kind: "list" } | { kind: "delete"; name: string } | { kind: "set"; name: string; text: string };
export function parseShortcutAction(input: string): ShortcutAction | null {
  const raw = input.trim();
  if (/^list$/i.test(raw)) return { kind: "list" };
  const del = /^(?:delete|del)\s+(\S+)$/i.exec(raw);
  if (del) { const name = shortcutName(del[1]); return name ? { kind: "delete", name } : null; }
  const set = /^set\s+([^\s|]+)\s*\|([\s\S]*)$/i.exec(raw);
  if (!set) return null;
  const name = shortcutName(set[1]);
  const text = shortcutText(set[2]);
  return name && text ? { kind: "set", name, text } : null;
}

function userPrefix(userId: number): string {
  if (!Number.isSafeInteger(userId) || userId <= 0) throw new Error("Invalid user id");
  return `${PREFIX}${userId}:`;
}
function itemKey(userId: number, name: string): string {
  const validated = shortcutName(name);
  if (!validated) throw new Error("Invalid shortcut name");
  return userPrefix(userId) + validated;
}

/** Count and upsert are one statement, so concurrent creates cannot exceed the cap. */
export async function saveShortcut(db: ShortcutDB, userId: number, name: string, value: string, now = Date.now()): Promise<boolean> {
  const key = itemKey(userId, name);
  const text = shortcutText(value);
  if (!text) throw new Error("Invalid shortcut text");
  const prefix = userPrefix(userId);
  const result = await db.prepare(`INSERT INTO kv_store (key,value_text,value_blob,expires_at,created_at)
    SELECT ?,?,NULL,NULL,? WHERE EXISTS(SELECT 1 FROM kv_store WHERE key=?) OR
    (SELECT COUNT(*) FROM kv_store WHERE key>=? AND key<?) < ?
    ON CONFLICT(key) DO UPDATE SET value_text=excluded.value_text,value_blob=NULL,expires_at=NULL`)
    .bind(key, text, Math.floor(now / 1000), key, prefix, prefix + "\uffff", MAX_SHORTCUTS).run();
  return Number((result.meta as { changes?: number } | undefined)?.changes ?? 0) > 0;
}

export async function getShortcut(db: ShortcutDB, userId: number, name: string): Promise<string | null> {
  const row = await db.prepare("SELECT value_text FROM kv_store WHERE key=?").bind(itemKey(userId, name)).first<{ value_text: string | null }>();
  // Revalidate old/corrupt rows before routing them as user input.
  return typeof row?.value_text === "string" ? shortcutText(row.value_text) : null;
}

export async function deleteShortcut(db: ShortcutDB, userId: number, name: string): Promise<boolean> {
  const result = await db.prepare("DELETE FROM kv_store WHERE key=?").bind(itemKey(userId, name)).run();
  return Number((result.meta as { changes?: number } | undefined)?.changes ?? 0) > 0;
}

export async function listShortcuts(db: ShortcutDB, userId: number): Promise<string[]> {
  const prefix = userPrefix(userId);
  const result = await db.prepare("SELECT key FROM kv_store WHERE key>=? AND key<? ORDER BY key LIMIT ?")
    .bind(prefix, prefix + "\uffff", MAX_SHORTCUTS).all<{ key: string }>();
  return (result.results ?? []).map(row => row.key.slice(prefix.length)).filter(name => shortcutName(name) === name);
}
