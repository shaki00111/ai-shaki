import test from "node:test";
import assert from "node:assert/strict";
import { awardGroupXp, getGroupLeaderboard, getGroupPlayerScore } from "../src/groupStats.ts";

function fakeDb({ changes = 1, value = "25", rows = [] } = {}) {
  const calls = [];
  return {
    calls,
    prepare(sql) {
      return { bind(...values) {
        return {
          async run() { calls.push({ kind: "run", sql, values }); return { meta: { changes } }; },
          async first() { calls.push({ kind: "first", sql, values }); return { value_text: value }; },
          async all() { calls.push({ kind: "all", sql, values }); return { results: rows }; },
        };
      }};
    },
  };
}

test("XP award uses one atomic idempotent D1 statement and group-scoped keys", async () => {
  const db = fakeDb({ value: "35" });
  const result = await awardGroupXp(db, -100123, 77, 10, "callback-abc", 1_800_000_000_000);
  assert.deepEqual(result, { awarded: true, xp: 35 });
  assert.equal(db.calls.length, 2);
  assert.match(db.calls[0].sql, /WHERE NOT EXISTS/);
  assert.match(db.calls[0].sql, /ON CONFLICT\(key\) DO UPDATE/);
  assert.deepEqual(db.calls[0].values, [
    "shaki:group-xp:v1:-100123:user:77",
    "shaki:group-xp:v1:-100123:user:77",
    10, 1_800_000_000, "shaki:group-xp:v1:-100123:event:callback-abc", 10,
  ]);
});

test("duplicate webhook event does not award XP twice", async () => {
  const db = fakeDb({ changes: 0, value: "20" });
  const result = await awardGroupXp(db, -100123, 77, 10, "same-event");
  assert.deepEqual(result, { awarded: false, xp: 20 });
});

test("XP inputs are validated and capped", async () => {
  const db = fakeDb();
  for (const amount of [0, -1, 101, 1.5, NaN]) {
    await assert.rejects(awardGroupXp(db, -100, 7, amount, "event"), /Invalid XP amount/);
  }
  await assert.rejects(awardGroupXp(db, 100, 7, 1, "event"), /group chat id/);
  await assert.rejects(awardGroupXp(db, -100, 0, 1, "event"), /user id/);
  await assert.rejects(awardGroupXp(db, -100, 7, 1, ""), /event id/);
  assert.equal(db.calls.length, 0);
});

test("player score reads only its group's namespaced key", async () => {
  const db = fakeDb({ value: "123" });
  assert.equal(await getGroupPlayerScore(db, -999, 12), 123);
  assert.deepEqual(db.calls[0].values, ["shaki:group-xp:v1:-999:user:12"]);
});

test("leaderboard query is group isolated, capped and sorts by XP", async () => {
  const db = fakeDb({ rows: [
    { key: "shaki:group-xp:v1:-55:user:2", value_text: "90" },
    { key: "shaki:group-xp:v1:-55:user:1", value_text: "40" },
    { key: "shaki:group-xp:v1:-55:user:bad", value_text: "999" },
  ] });
  const rows = await getGroupLeaderboard(db, -55, 500);
  assert.deepEqual(rows, [{ userId: 2, xp: 90 }, { userId: 1, xp: 40 }]);
  assert.deepEqual(db.calls[0].values, ["shaki:group-xp:v1:-55:user:", "shaki:group-xp:v1:-55:user:\\uffff", 20]);
  assert.match(db.calls[0].sql, /ORDER BY CAST\(value_text AS INTEGER\) DESC/);
});
