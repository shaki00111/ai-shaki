import test from "node:test";
import assert from "node:assert/strict";
import { isTelegramMemberPresent, shouldSendGroupOnboarding } from "../src/groupOnboarding.ts";

test("sends onboarding only on a real transition into the group", () => {
  assert.equal(shouldSendGroupOnboarding({ status: "left" }, { status: "member" }), true);
  assert.equal(shouldSendGroupOnboarding({ status: "kicked" }, { status: "administrator" }), true);
  assert.equal(shouldSendGroupOnboarding({ status: "member" }, { status: "administrator" }), false);
  assert.equal(shouldSendGroupOnboarding({ status: "administrator" }, { status: "member" }), false);
  assert.equal(shouldSendGroupOnboarding({ status: "member" }, { status: "left" }), false);
});

test("handles restricted membership transitions", () => {
  assert.equal(isTelegramMemberPresent({ status: "restricted", is_member: true }), true);
  assert.equal(isTelegramMemberPresent({ status: "restricted", is_member: false }), false);
  assert.equal(shouldSendGroupOnboarding({ status: "restricted", is_member: false }, { status: "restricted", is_member: true }), true);
});
