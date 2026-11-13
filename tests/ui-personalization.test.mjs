import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_OWNER_UI_CUSTOMIZATION,
  normalizeOwnerUiCustomization,
  ownerUiButtonLabel,
  ownerUiButtons,
  ownerUiWelcome,
} from "../src/uiPersonalization.ts";

test("normalization only accepts known button ids and bounds labels/text", () => {
  const value = normalizeOwnerUiCustomization({
    labels: { personas: "شخصیت من", injected: "bad", close: "x".repeat(80) },
    hidden: ["help", "not-real"],
    order: ["close", "close", "not-real"],
    welcomeTextFa: "x".repeat(1300),
  });
  assert.equal(value.labels.personas, "شخصیت من");
  assert.equal(value.labels.injected, undefined);
  assert.equal(value.labels.close?.length, 48);
  assert.deepEqual(value.hidden, ["help"]);
  assert.equal(new Set(value.order).size, value.order.length);
  assert.equal(value.welcomeTextFa.length, 1200);
});

test("custom button order and hidden items preserve stable callbacks", () => {
  const custom = normalizeOwnerUiCustomization({ order: ["close", "personas"], hidden: ["help"] });
  const buttons = ownerUiButtons(custom, false);
  assert.equal(buttons[0].id, "close");
  assert.equal(buttons.find(button => button.id === "personas")?.callback, "home:personas");
  assert.equal(buttons.some(button => button.id === "group_settings"), false);
  assert.equal(ownerUiButtonLabel("personas", custom), "🎭 انتخاب شخصیت (فقط برای من)");
});

test("welcome text escapes HTML and substitutes the name placeholder", () => {
  const custom = normalizeOwnerUiCustomization({ welcomeTextFa: "سلام {name} <script>" });
  assert.equal(ownerUiWelcome(custom, "fa", "fallback", "<آرمان>"), "سلام &lt;آرمان&gt; &lt;script&gt;");
  assert.equal(ownerUiWelcome(DEFAULT_OWNER_UI_CUSTOMIZATION, "fa", "fallback", "A"), "fallback");
});
