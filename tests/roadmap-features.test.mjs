import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parsePhotoStyleCommand, photoStyleInstruction } from "../src/photoStyles.ts";
import { classifyRequestIntent } from "../src/intent.ts";
import { dailyQuiz, sendGroupQuiz } from "../src/groupQuiz.ts";

test("photo style commands accept only commands addressed to the bot", () => {
  assert.deepEqual(parsePhotoStyleCommand('/ANIME@ShakiBot in space', 'shakibot'), { style: 'anime', detail: 'in space' });
  assert.deepEqual(parsePhotoStyleCommand('/cartoon', 'shakibot'), { style: 'cartoon', detail: '' });
  assert.equal(parsePhotoStyleCommand('/anime@otherbot', 'shakibot'), null);
  assert.equal(parsePhotoStyleCommand('/animes', 'shakibot'), null);
  assert.equal(photoStyleInstruction('anime', 'x'.repeat(501)), null);
});

test("anime and cartoon shortcuts route to the existing forced image-edit tool", () => {
  for (const style of ['anime', 'cartoon']) {
    const text = photoStyleInstruction(style, '');
    const decision = classifyRequestIntent({ text, isGroup: false, isReply: true, repliedHasImage: true });
    assert.equal(decision.category, 'image_edit');
    assert.equal(decision.forceToolCall, true);
    assert.deepEqual(decision.allowedTools, ['edit_image']);
    assert.equal(decision.slots.imageSource, 'reply');
  }
});

test("daily quiz is stable, localized, bounded and cycles without network", () => {
  for (let i = 0; i < 10; i++) {
    const start = new Date(i * 86_400_000);
    const fa = dailyQuiz(start, 'fa');
    const en = dailyQuiz(start, 'en');
    assert.equal(fa.options.length, 3);
    assert.equal(fa.correctOptionId, en.correctOptionId);
    assert.ok(fa.correctOptionId >= 0 && fa.correctOptionId < fa.options.length);
    assert.deepEqual(dailyQuiz(new Date(i * 86_400_000 + 86_399_999), 'fa'), fa);
  }
  assert.deepEqual(dailyQuiz(new Date(0), 'en'), dailyQuiz(new Date(10 * 86_400_000), 'en'));
  assert.throws(() => dailyQuiz(new Date(NaN), 'fa'), RangeError);
  assert.equal(dailyQuiz(new Date(-1), 'en').question, dailyQuiz(new Date(9 * 86_400_000), 'en').question);
});

test("quiz submits native anonymous Telegram quiz and never retries on failure", async () => {
  let n = 0;
  const quiz = dailyQuiz(new Date(0), 'fa');
  await sendGroupQuiz(async (method, params) => {
    n++;
    assert.equal(method, 'sendPoll');
    assert.equal(params.chat_id, -100);
    assert.equal(params.type, 'quiz');
    assert.equal(params.is_anonymous, true);
    assert.equal(params.correct_option_id, quiz.correctOptionId);
    assert.deepEqual(params.options, quiz.options.map(text => ({ text })));
  }, -100, 15, quiz);
  assert.equal(n, 1);
  n = 0;
  await assert.rejects(sendGroupQuiz(async () => { n++; throw new Error('timeout'); }, -100, 15, quiz), /timeout/);
  assert.equal(n, 1);
});

test("worker protects style and group quiz entry points", () => {
  const src = readFileSync(new URL('../src/index.ts', import.meta.url), 'utf8');
  const style = src.slice(src.indexOf('const photoStyle = parsePhotoStyleCommand'), src.indexOf('// ── Inline handoff'));
  assert.match(style, /reply\?\.photo\?\.length/);
  assert.match(style, /if \(!hasSource \|\| !instruction\)/);
  assert.match(style, /msg = \{ \.\.\.msg, text \}/);
  const start = src.indexOf('case "/quiz":');
  const end = src.indexOf('case "/card":', start);
  const quiz = src.slice(start, end);
  assert.ok(start > src.indexOf('if (chat.type !== "private" && !await isGroupEnabled'));
  assert.match(quiz, /if \(!isGroup\)/);
  assert.match(quiz, /isUserAdmin\(from.id, chat.id\)/);
  assert.match(quiz, /getUserBucket\(from.id, session.vipStatus\)\.tryConsume/);
  assert.match(quiz, /isDuplicateUserRequest/);
});
