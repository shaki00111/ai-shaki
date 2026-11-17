import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parsePollDraft, sendAnonymousPoll } from "../src/polls.ts";

test("parses Persian and English options, trimming whitespace", () => {
  assert.deepEqual(parsePollDraft(" سؤال؟  | آره | نه "), { question: "سؤال؟", options: ["آره", "نه"] });
});

test("rejects missing, duplicate, overlong, and too many options", () => {
  for (const input of ["", "question | only", "q | a |", "q | a | A", "q | a | ａ", "x".repeat(301) + " | a | b", "q | " + "x".repeat(101) + " | b", "q | " + Array.from({ length: 11 }, (_, i) => `o${i}`).join(" | ")]) {
    assert.equal(parsePollDraft(input), null, input);
  }
  assert.equal(parsePollDraft("q | " + Array.from({ length: 10 }, (_, i) => `o${i}`).join(" | ")).options.length, 10);
});

test("sends one native anonymous Telegram poll with exact data", async () => {
  const calls = [];
  await sendAnonymousPoll(async (method, params) => calls.push({ method, params }), 42, 7, parsePollDraft("موضوع؟ | بله | خیر"));
  assert.deepEqual(calls, [{ method: "sendPoll", params: { chat_id: 42, question: "موضوع؟", options: [{ text: "بله" }, { text: "خیر" }], is_anonymous: true, allows_multiple_answers: false, reply_to_message_id: 7 } }]);
});

test("a send error propagates without sending a second poll", async () => {
  let count = 0;
  await assert.rejects(sendAnonymousPoll(async () => { count++; throw new Error("timeout"); }, 1, 2, parsePollDraft("q|a|b")), /timeout/);
  assert.equal(count, 1);
});

test("poll dispatch retains gates, group-admin check, dedup and rate limit", () => {
  const source = readFileSync(new URL("../src/index.ts", import.meta.url), "utf8");
  const start = source.indexOf('case "/poll": {');
  const end = source.indexOf('case "/leaderboard":', start);
  const command = source.slice(start, end);
  assert.ok(start > source.indexOf('if (chat.type !== "private" && !await isGroupEnabled'));
  assert.match(command, /isUserAdmin\(from\.id, chat\.id\)/);
  assert.match(command, /isDuplicateUserRequest/);
  assert.match(command, /getUserBucket\(from\.id, session\.vipStatus\)\.tryConsume/);
  assert.match(command, /sendAnonymousPoll\(tg, chat\.id, msg\.message_id, draft\)/);
});
