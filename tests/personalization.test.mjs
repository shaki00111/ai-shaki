import { test } from "node:test";
import assert from "node:assert/strict";
import {
  OWNER_MENU_ITEMS, normalizeOwnerPersonalization, applyOwnerMenuPersonalization,
  ownerPersonalizationPreview,
} from "../src/ownerPersonalization.ts";

test("normalization only accepts known ids and bounds labels", () => {
  const value = normalizeOwnerPersonalization({
    labels: { personas: "  🎭 شخصیت من  ", close: "بستن", unknown: "bad", help: "x".repeat(80) },
    hidden: ["personas", "help", "bad", "help"],
    order: ["close", "close", "unknown", "help"],
  });
  assert.equal(value.labels.personas, "🎭 شخصیت من");
  assert.equal(value.labels.help.length, 40);
  assert.equal(value.labels.unknown, undefined);
  assert.deepEqual(value.hidden, ["help"]);
  assert.equal(value.order[0], "close");
  assert.equal(new Set(value.order).size, OWNER_MENU_ITEMS.length);
});

test("menu customization changes labels and visibility but preserves callback targets", () => {
  const source = { inline_keyboard: [[
    { text: "persona default", callback_data: "home:personas" },
    { text: "help default", callback_data: "home:help" },
    { text: "VIP default", callback_data: "home:vip" },
  ], [{ text: "close default", callback_data: "home:close" }]] };
  const result = applyOwnerMenuPersonalization(source, {
    labels: { personas: "شخصیت", help: "راهنما جدید", vip: "VIP جدید" },
    hidden: ["vip"],
    order: ["help", "personas", "close"],
  });
  const flat = result.inline_keyboard.flat();
  assert.deepEqual(flat.map(x => x.text), ["راهنما جدید", "شخصیت", "close default"]);
  assert.deepEqual(flat.map(x => x.callback_data), ["home:help", "home:personas", "home:close"]);
});

test("required persona and close controls cannot be hidden", () => {
  const preview = ownerPersonalizationPreview({ hidden: ["personas", "close"] });
  assert.ok(preview.includes("🎭 تغییر شخصیت"));
  assert.ok(preview.includes("✖️ بستن منو"));
});
