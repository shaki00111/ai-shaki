import test from "node:test";
import assert from "node:assert/strict";
import { readVipEntitlementSnapshot, isVipEntitlementActive, resolveVipExpiry } from "../src/vipEntitlement.ts";

test("persisted VIP entitlement is normalized without touching usage", () => {
  const snapshot = readVipEntitlementSnapshot({
    vipStatus: true, vipExpiresAt: 5000,
    vipPermissions: { voice_sent: true, image: false, invalid: "yes" },
    vipLimits: { voice_sent: 100, image: -1, bad: "x" },
    dailyLimits: { voicesSent: 999 },
  });
  assert.equal(snapshot.vipStatus, true);
  assert.equal(snapshot.vipPermissions?.voice_sent, true);
  assert.equal(snapshot.vipPermissions?.image, false);
  assert.equal(snapshot.vipPermissions?.invalid, undefined);
  assert.equal(snapshot.vipLimits?.voice_sent, 100);
  assert.equal(snapshot.vipLimits?.image, undefined);
  assert.equal(isVipEntitlementActive(snapshot, 4999), true);
  assert.equal(isVipEntitlementActive(snapshot, 5000), false);
});

test("permanent and non-VIP entitlements are handled correctly", () => {
  assert.equal(isVipEntitlementActive(readVipEntitlementSnapshot({ vipStatus: true }), 999), true);
  assert.equal(isVipEntitlementActive(readVipEntitlementSnapshot({ vipStatus: false }), 999), false);
});


test("VIP quota never inherits a stale free-tier override", async () => {
  const { resolveVipDailyLimit } = await import("../src/vipEntitlement.ts");
  assert.equal(resolveVipDailyLimit(true, 100, 0, 30), 100);
  assert.equal(resolveVipDailyLimit(true, undefined, 0, 30), 30);
  assert.equal(resolveVipDailyLimit(true, 0, 90, 30), 0);
  assert.equal(resolveVipDailyLimit(false, undefined, 0, 3), 0);
  assert.equal(resolveVipDailyLimit(false, undefined, undefined, 3), 3);
});


test("renewing a permanent VIP never downgrades it to a temporary plan", () => {
  const now = 1_800_000_000_000;
  assert.equal(resolveVipExpiry(true, undefined, 30, now), undefined);
  assert.equal(resolveVipExpiry(true, 0, 30, now), undefined);
  assert.equal(resolveVipExpiry(false, undefined, 30, now), now + 30 * 86_400_000);
  assert.equal(resolveVipExpiry(true, now + 10 * 86_400_000, 30, now), now + 40 * 86_400_000);
  assert.equal(resolveVipExpiry(false, undefined, 0, now), undefined);
});
