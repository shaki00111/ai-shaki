import test from "node:test";
import assert from "node:assert/strict";
import { SUBSCRIPTION_PLANS, formatSubscriptionPricing } from "../src/subscriptionPricing.ts";

test("subscription catalog contains the requested weekly and monthly prices", () => {
  assert.deepEqual(SUBSCRIPTION_PLANS.map(({ days, priceToman }) => [days, priceToman]), [
    [7, 50_000], [30, 100_000], [60, 200_000], [90, 300_000],
    [120, 400_000], [150, 500_000],
  ]);
});

test("Persian pricing message shows every package in Toman", () => {
  const message = formatSubscriptionPricing("fa");
  for (const expected of ["یک هفته", "۵۰٬۰۰۰ تومان", "یک ماه", "۱۰۰٬۰۰۰ تومان", "دو ماه", "۲۰۰٬۰۰۰ تومان", "سه ماه", "۳۰۰٬۰۰۰ تومان", "چهار ماه", "۴۰۰٬۰۰۰ تومان", "پنج ماه", "۵۰۰٬۰۰۰ تومان"]) {
    assert.ok(message.includes(expected), `missing ${expected}`);
  }
});

test("English pricing message is localized", () => {
  const message = formatSubscriptionPricing("en");
  assert.match(message, /1 week/);
  assert.match(message, /5 months/);
  assert.match(message, /Toman/);
});

test("pricing is display-only and does not mutate the catalog", () => {
  const before = JSON.stringify(SUBSCRIPTION_PLANS);
  formatSubscriptionPricing("fa");
  formatSubscriptionPricing("en");
  assert.equal(JSON.stringify(SUBSCRIPTION_PLANS), before);
});
