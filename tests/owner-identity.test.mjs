import test from "node:test";
import assert from "node:assert/strict";
import { isOwnerIdentityQuestion, ownerIdentityReply } from "../src/ownerIdentity.ts";

test("recognizes direct Persian owner and creator questions", () => {
  for (const text of ["بابات کیه؟", "مالکت کیه؟", "سازندت کیه؟", "کی ساختت؟", "چه کسی تو رو ساخته؟", "خالق تو کیست؟"]) {
    assert.equal(isOwnerIdentityQuestion(text), true, text);
    assert.match(ownerIdentityReply(text) ?? "", /@SHAKI0030/);
  }
});
test("recognizes direct English owner questions", () => {
  for (const text of ["Who made you?", "Who is your creator?", "Who owns you?", "Who is your developer?"]) {
    assert.equal(isOwnerIdentityQuestion(text), true, text);
    assert.match(ownerIdentityReply(text) ?? "", /@SHAKI0030/);
  }
});
test("ignores ordinary mentions and unrelated questions", () => {
  for (const text of ["سلام شاکی", "آرمان امروز آنلاین بود", "مالکیت شرکت چطور است؟", "تو خیلی خوبی"]) {
    assert.equal(isOwnerIdentityQuestion(text), false, text);
    assert.equal(ownerIdentityReply(text), null, text);
  }
});
