import test from "node:test";
import assert from "node:assert/strict";
import { friendlyFailure, WriteGovernor } from "../src/storageHealth.ts";

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
