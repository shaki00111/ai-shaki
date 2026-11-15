import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const publicApp = readFileSync("src/dashboard.html", "utf8");
const ownerApp = readFileSync("src/adminDashboard.html", "utf8");

test("public Mini App keeps its chat, upload, conversation and persona controls", () => {
  for (const id of ["app", "chatScroll", "composerBar", "sendBtn", "attachInput", "convList", "personaSheet", "usageSheet"]) {
    assert.ok(publicApp.includes('id="' + id + '"'), "missing public control: " + id);
  }
  for (const endpoint of ['api("chat"', 'api("conversations"', 'api("personas"']) {
    assert.ok(publicApp.includes(endpoint), "missing public API contract: " + endpoint);
  }
});

test("owner Mini App keeps auth and management sections", () => {
  for (const id of ["authBanner", "sidebarNav", "mainContent", "panel-overview", "panel-users", "panel-vip", "panel-groups"]) {
    assert.ok(ownerApp.includes('id="' + id + '"'), "missing owner control: " + id);
  }
  for (const endpoint of ["/api/admin/overview", "/api/admin/users", "/api/admin/providers", "/api/admin/keys", "/api/admin/system"]) {
    assert.ok(ownerApp.includes(endpoint), "missing owner API route: " + endpoint);
  }
});

test("both Mini Apps include the isolated Cyber Glass visual-only stage", () => {
  assert.match(publicApp, /<style id="shaki-cyberglass-stage1">/);
  assert.match(ownerApp, /<style id="shaki-cyberglass-stage1">/);
  assert.match(publicApp, /prefers-reduced-motion:reduce/);
  assert.match(ownerApp, /prefers-reduced-motion:reduce/);
});
