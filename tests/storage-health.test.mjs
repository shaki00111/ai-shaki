import test from "node:test";
import assert from "node:assert/strict";
import { friendlyFailure, WriteGovernor, governDatabase, storageGovernor } from "../src/storageHealth.ts";

test("free and VIP users receive safe Persian wording without provider diagnostics", () => {
  const error = new Error("CF_API [HTTP 429]: token=do-not-show");
  const message = friendlyFailure(error, "fa");
  assert.match(message, /سرور فعلاً شلوغه عشقم/);
  assert.doesNotMatch(message, /CF_API|429|do-not-show/);
  assert.equal(friendlyFailure(error, "fa"), message);
});

test("failure categories remain actionable and English is safe too", () => {
  assert.match(friendlyFailure(new Error("D1 daily quota exceeded"), "fa"), /ذخیره‌سازی/);
  assert.match(friendlyFailure(new Error("rate limit 429"), "fa"), /شلوغه عشقم/);
  assert.match(friendlyFailure(new Error("network timeout"), "fa"), /سرور جواب نداد عشقم/);
  assert.doesNotMatch(friendlyFailure(new Error("provider secret=hidden"), "en"), /secret|hidden/);
});

test("D1 internal storage reset triggers transient write backpressure", () => {
  let now = 1_000;
  const governor = new WriteGovernor(() => now);
  governor.failure(new Error("D1_ERROR: Internal error in D1 DB storage caused object to be reset"));
  assert.equal(governor.reason, "transient");
  assert.equal(governor.available, false);
  assert.equal(governor.blockedUntil, 3_000);
  now = 3_000;
  assert.equal(governor.available, true);
});


test("D1 daily row-read quota is recognized and blocks until the next UTC reset", () => {
  const now = Date.UTC(2026, 10, 15, 10, 0, 0);
  const governor = new WriteGovernor(() => now);
  governor.failure(new Error("Your account has exceeded D1's free tier daily row read limit. Upgrade or wait until midnight UTC."));
  assert.equal(governor.reason, "daily_quota");
  assert.equal(governor.blockedUntil, Date.UTC(2026, 10, 16, 0, 1, 0));
  assert.equal(governor.available, false);
});

test("D1 read quota errors trigger backpressure for later reads and writes", async () => {
  const quotaError = new Error("Your account has exceeded D1's free tier daily row read limit.");
  const nativeStatement = {
    bind() { return this; },
    first: async () => { throw quotaError; },
    all: async () => ({ results: [] }),
    raw: async () => [],
    run: async () => ({ meta: { rows_written: 1 } }),
  };
  const guarded = governDatabase({ prepare: () => nativeStatement });
  await assert.rejects(guarded.prepare("SELECT 1").first(), /daily row read limit/);
  await assert.rejects(guarded.prepare("SELECT 1").all(), /STORAGE_WRITE_BACKPRESSURE/);
  await assert.rejects(guarded.prepare("INSERT INTO t VALUES (1)").run(), /STORAGE_WRITE_BACKPRESSURE/);
  const snapshot = storageGovernor(guarded).snapshot();
  assert.equal(snapshot.available, false);
  assert.equal(snapshot.reason, "daily_quota");
  assert.equal(snapshot.reads, 0);
  assert.equal(snapshot.rejected, 2);
});

test("successful D1 reads are counted without being counted as writes", async () => {
  const nativeStatement = {
    bind() { return this; },
    first: async () => ({ id: 1 }),
    all: async () => ({ results: [{ id: 1 }] }),
    raw: async () => [[1]],
    run: async () => ({ meta: { rows_written: 1 } }),
  };
  const guarded = governDatabase({ prepare: () => nativeStatement });
  assert.deepEqual(await guarded.prepare("SELECT 1").first(), { id: 1 });
  const snapshot = storageGovernor(guarded).snapshot();
  assert.equal(snapshot.reads, 1);
  assert.equal(snapshot.writes, 0);
});
