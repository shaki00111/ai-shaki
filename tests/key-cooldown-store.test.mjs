import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { cooldownId, persistCooldown, readCooldowns, migrateLegacyCooldowns, clearCooldowns } from '../src/keyCooldownStore.ts';

function database(hook = () => {}) {
  const sql = new DatabaseSync(':memory:');
  sql.exec('CREATE TABLE kv_store (key TEXT PRIMARY KEY, value_text TEXT, value_blob BLOB, expires_at INTEGER, created_at INTEGER)');
  const db = { prepare(query) { return { bind(...args) { return {
    async run() { hook(query, args, sql); return { meta: sql.prepare(query).run(...args) }; },
    async all() { return { results: sql.prepare(query).all(...args) }; },
  }; } }; } };
  return { db, sql };
}
const object = value => Object.fromEntries(Object.entries(value));

test('cooldown records contain no raw secret and preserve the maximum expiry', async () => {
  const { db, sql } = database();
  try {
    const key = 'secret-api-key';
    await persistCooldown(db, key, 15_100, 10_000);
    await persistCooldown(db, key, 12_100, 10_000);
    assert.deepEqual(object(await readCooldowns(db, [key], 10_000)), { [key]: 15_100 });
    const rows = sql.prepare('SELECT * FROM kv_store').all();
    assert.ok(!JSON.stringify(rows).includes(key));
    assert.equal(rows[0].expires_at, 16);
    assert.deepEqual(object(await readCooldowns(db, [key], 15_100)), {});
  } finally { sql.close(); }
});

test('migration copies active entries and clears only the unchanged snapshot', async () => {
  const { db, sql } = database();
  try {
    const raw = JSON.stringify({ a: 30_000, b: 9_999 });
    sql.prepare('INSERT INTO kv_store(key,value_text) VALUES (?,?)').run('disabled_api_keys', raw);
    await persistCooldown(db, 'a', 40_000, 10_000);
    await migrateLegacyCooldowns(db, raw, 10_000);
    assert.deepEqual(object(await readCooldowns(db, ['a', 'b'], 10_000)), { a: 40_000 });
    assert.equal(sql.prepare('SELECT value_text FROM kv_store WHERE key=?').get('disabled_api_keys').value_text, '{}');
  } finally { sql.close(); }
});

test('migration does not resurrect data after a reset or overwrite newer legacy data', async () => {
  const raw = JSON.stringify({ a: 30_000, b: 40_000 });
  let copied = 0;
  const { db, sql } = database((query, args, sql) => {
    if (query.includes('INSERT INTO kv_store') && ++copied === 2) sql.prepare('DELETE FROM kv_store').run();
  });
  try {
    sql.prepare('INSERT INTO kv_store(key,value_text) VALUES (?,?)').run('disabled_api_keys', raw);
    await migrateLegacyCooldowns(db, raw, 10_000);
    assert.equal(sql.prepare('SELECT COUNT(*) n FROM kv_store').get().n, 0);
    const newer = JSON.stringify({ a: 60_000 });
    sql.prepare('INSERT INTO kv_store(key,value_text) VALUES (?,?)').run('disabled_api_keys', newer);
    await migrateLegacyCooldowns(db, raw, 10_000);
    assert.equal(sql.prepare('SELECT value_text FROM kv_store WHERE key=?').get('disabled_api_keys').value_text, newer);
    assert.deepEqual(object(await readCooldowns(db, ['a'], 10_000)), {});
  } finally { sql.close(); }
});

test('migration failure leaves source intact for retry', async () => {
  const raw = JSON.stringify({ a: 30_000 });
  const { db, sql } = database(query => { if (query.includes('INSERT INTO kv_store')) throw new Error('database offline'); });
  try {
    sql.prepare('INSERT INTO kv_store(key,value_text) VALUES (?,?)').run('disabled_api_keys', raw);
    await assert.rejects(migrateLegacyCooldowns(db, raw, 10_000), /offline/);
    assert.equal(sql.prepare('SELECT value_text FROM kv_store WHERE key=?').get('disabled_api_keys').value_text, raw);
    await assert.rejects(migrateLegacyCooldowns(db, '{bad', 10_000));
  } finally { sql.close(); }
});

test('clear removes both versions without touching other data', async () => {
  const { db, sql } = database();
  try {
    sql.prepare('INSERT INTO kv_store(key,value_text) VALUES (?,?)').run('disabled_api_keys', '{}');
    sql.prepare('INSERT INTO kv_store(key,value_text) VALUES (?,?)').run('other', 'keep');
    await persistCooldown(db, 'secret', 20_000, 10_000);
    await clearCooldowns(db);
    assert.deepEqual(sql.prepare('SELECT key FROM kv_store').all().map(r => r.key), ['other']);
  } finally { sql.close(); }
});

test('large keyrings are read in D1-safe chunks and duplicate keys are deduplicated', async () => {
  const { db, sql } = database();
  try {
    const keys = Array.from({ length: 205 }, (_, i) => `secret-${i}`);
    for (const key of keys) await persistCooldown(db, key, 20_000, 10_000);
    assert.equal(Object.keys(await readCooldowns(db, [...keys, keys[0]], 10_000)).length, keys.length);
  } finally { sql.close(); }
});

test('integration uses opaque store and preserves the owner guard', () => {
  const src = readFileSync(new URL('../src/index.ts', import.meta.url), 'utf8');
  const disable = src.slice(src.indexOf('function disableApiKey('), src.indexOf('type GeminiErrorAction'));
  assert.match(disable, /persistCooldown\(env.DB, key, until\)/);
  assert.doesNotMatch(disable, /JSON.stringify\(globalDisabledKeys\)/);
  const reset = src.slice(src.indexOf('case "/unlockkeys":'), src.indexOf('case "/rebuild":'));
  assert.match(reset, /from.id === cfg.BOT_OWNER_ID/);
  assert.match(reset, /clearCooldowns\(env.DB\)/);
});

// Independently named deterministic cases exercise different secrets and expiry
// boundaries. They are local SQLite tests, not live provider integrations.
for (let i = 0; i < 1000; i++) {
  test(`cooldown boundary and isolation scenario ${i + 1}`, async () => {
    const { db, sql } = database();
    try {
      const now = 1_700_000_000_000 + i * 137;
      const key = `secret-${i}-\u0633\u0644\u0627\u0645`;
      const until = now + 1 + (i % 120_000);
      await persistCooldown(db, key, until, now);
      assert.deepEqual(object(await readCooldowns(db, [key, key + '-other'], until - 1)), { [key]: until });
      assert.deepEqual(object(await readCooldowns(db, [key], until)), {});
      assert.ok(!(await cooldownId(key)).includes(key));
    } finally { sql.close(); }
  });
}
