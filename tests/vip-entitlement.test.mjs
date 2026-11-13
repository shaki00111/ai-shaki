import test from "node:test";
import assert from "node:assert/strict";
import { readVipEntitlementSnapshot, isVipEntitlementActive } from "../src/vipEntitlement.ts";

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
