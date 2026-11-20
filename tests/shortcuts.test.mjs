import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { shortcutName, shortcutText, parseShortcutAction, saveShortcut, getShortcut, deleteShortcut, listShortcuts, MAX_SHORTCUTS } from '../src/shortcuts.ts';

function database() {
  const sql = new DatabaseSync(':memory:');
  sql.exec('CREATE TABLE kv_store (key TEXT PRIMARY KEY, value_text TEXT, value_blob BLOB, expires_at INTEGER, created_at INTEGER)');
  return { sql, db: { prepare(query) { return { bind(...args) { return {
    async run() { const result = sql.prepare(query).run(...args); return { meta: { changes: Number(result.changes) } }; },
    async first() { return sql.prepare(query).get(...args) ?? null; },
    async all() { return { results: sql.prepare(query).all(...args) }; },
  }; } }; } } };
}

test('validates names, commands and text without allowing slash commands', () => {
  assert.equal(shortcutName(' News_2 '), 'news_2');
  for (const name of ['../bad', '2bad', 'سلام', 'a'.repeat(25), '']) assert.equal(shortcutName(name), null);
  for (const value of ['', ' /admin', '\u0000hello', 'x'.repeat(1001)]) assert.equal(shortcutText(value), null);
  assert.deepEqual(parseShortcutAction('set news | خبرهای فناوری رو خلاصه کن'), { kind: 'set', name: 'news', text: 'خبرهای فناوری رو خلاصه کن' });
  assert.deepEqual(parseShortcutAction('del NEWS'), { kind: 'delete', name: 'news' });
  assert.deepEqual(parseShortcutAction('list'), { kind: 'list' });
  assert.equal(parseShortcutAction('set x | /admin'), null);
});

test('real SQLite upserts, cap, deletion, isolation and update-at-cap', async () => {
  const { db, sql } = database();
  try {
    for (let i = 0; i < MAX_SHORTCUTS; i++) assert.equal(await saveShortcut(db, 1, 'n' + i, 'request ' + i), true);
    assert.equal(await saveShortcut(db, 1, 'overflow', 'request'), false);
    assert.equal(await saveShortcut(db, 1, 'n0', 'updated'), true);
    assert.equal(await getShortcut(db, 1, 'n0'), 'updated');
    assert.equal(await getShortcut(db, 2, 'n0'), null);
    assert.equal(await saveShortcut(db, 2, 'n0', 'other user'), true);
    assert.equal((await listShortcuts(db, 1)).length, MAX_SHORTCUTS);
    assert.deepEqual(await listShortcuts(db, 2), ['n0']);
    assert.equal(await deleteShortcut(db, 1, 'n0'), true);
    assert.equal(await deleteShortcut(db, 1, 'n0'), false);
    assert.equal(await getShortcut(db, 2, 'n0'), 'other user');
    assert.equal(await saveShortcut(db, 1, 'overflow', 'now fits'), true);
  } finally { sql.close(); }
});

test('shortcut prefix reads use the indexed key range', () => {
  const { sql } = database();
  try {
    const plan = sql.prepare('EXPLAIN QUERY PLAN SELECT COUNT(*) FROM kv_store WHERE key>=? AND key<?').all('shortcut:v1:1:', 'shortcut:v1:1:\uffff');
    assert.ok(plan.some(row => /SEARCH.*INDEX/i.test(row.detail)), JSON.stringify(plan));
  } finally { sql.close(); }
});

test('invalid database values fail closed and invalid user ids are rejected', async () => {
  const { db, sql } = database();
  try {
    sql.prepare('INSERT INTO kv_store (key,value_text) VALUES (?,?)').run('shortcut:v1:1:bad', '/admin');
    assert.equal(await getShortcut(db, 1, 'bad'), null);
    await assert.rejects(saveShortcut(db, 0, 'x', 'hello'), /Invalid user id/);
    await assert.rejects(saveShortcut(db, 1, 'x', '/admin'), /Invalid shortcut text/);
  } finally { sql.close(); }
});

test('shortcut dispatch is private for management and subject to regular gates on execution', () => {
  const source = readFileSync(new URL('../src/index.ts', import.meta.url), 'utf8');
  const expand = source.slice(source.indexOf('const shortcutRun ='), source.indexOf('// Route explicit style shortcuts'));
  assert.match(expand, /getShortcut\(env.DB, from.id, name\)/);
  assert.match(expand, /shortcutPrecharged = true/);
  assert.match(expand, /msg = \{ \.\.\.msg, text \}/);
  assert.ok(source.indexOf('const shortcutRun =') > source.indexOf('await isUserBlocked(session, from, env)'));
  const manage = source.slice(source.indexOf('case "/shortcut":'), source.indexOf('case "/poll":'));
  assert.match(manage, /if \(isGroup\)/);
  assert.match(manage, /saveShortcut\(env.DB, from.id/);
  assert.match(source, /if \(!shortcutPrecharged && !bucket.tryConsume\(\)\)/);
});
