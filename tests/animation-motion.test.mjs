import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const admin = readFileSync(new URL("../src/adminDashboard.html", import.meta.url), "utf8");
const user = readFileSync(new URL("../src/userDashboard.html", import.meta.url), "utf8");

test("admin companion and dashboard animations are not globally disabled", () => {
  assert.match(admin, /@keyframes shaki-bob/);
  assert.match(admin, /@keyframes shaki-twinkle/);
  assert.doesNotMatch(admin, /\*,\*::before,\*::after\{animation:none!important;transition:none!important;scroll-behavior:auto!important\}/);
  assert.match(admin, /prefers-reduced-motion:reduce/);
});

test("personal dashboard transitions remain active while reduced-motion preference is respected", () => {
  assert.doesNotMatch(user, /\*,\*::before,\*::after\{animation:none!important;transition:none!important;scroll-behavior:auto!important\}/);
  assert.match(user, /prefers-reduced-motion:reduce/);
});
