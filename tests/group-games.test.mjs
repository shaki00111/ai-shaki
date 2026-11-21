import test from "node:test";
import assert from "node:assert/strict";
import {
  applyGamePower, clearGameSession, createGameSession, gameMenu, loadGameSession,
  parseGameKind, playGame, renderGame, saveGameSession,
} from "../src/groupGames.ts";

function memoryDb(){
  const values=new Map();
  return {values,prepare(sql){
    return {bind(...args){return {
      async run(){
        if(sql.startsWith("DELETE")){values.delete(String(args[0]));return {meta:{changes:1}};}
        values.set(String(args[0]),String(args[1]));return {meta:{changes:1}};
      },
      async first(){const value=values.get(String(args[0]));return value===undefined?null:{value_text:value};},
      async all(){return {results:[]};},
    };}};
  }};
}

test("game menu offers seven text-first games with callback navigation",()=>{
  const menu=gameMenu();
  assert.equal(menu.rows.flat().length,10);
  assert.ok(menu.rows.flat().every(button=>button.callback_data.startsWith("shaki_game:")));
  for(const kind of ["rps","number","quiz","word","dice","truth","emoji","coin","math","memory"]) assert.equal(parseGameKind(kind),kind);
  assert.equal(parseGameKind("not-a-game"),null);
});

test("game sessions are isolated by group and player and persist in D1",async()=>{
  const db=memoryDb();
  const state=createGameSession(-100,77,"number");
  await saveGameSession(db,state);
  assert.equal((await loadGameSession(db,-100,77))?.id,state.id);
  assert.equal(await loadGameSession(db,-200,77),null);
  assert.equal(await loadGameSession(db,-100,88),null);
  await clearGameSession(db,-100,77);
  assert.equal(await loadGameSession(db,-100,77),null);
});

test("number game keeps attempts until success or exhaustion",()=>{
  const state=createGameSession(-100,77,"number");
  const wrong=state.secret===1?2:1;
  let screen=playGame(state,String(wrong));
  assert.equal(screen.finished,false);
  assert.equal(state.attempts,2);
  screen=playGame(state,String(state.secret));
  assert.equal(screen.finished,true);
  assert.equal(screen.outcome,"win");
});

test("quiz and emoji answers award a correct-answer outcome",()=>{
  for(const kind of ["quiz","emoji"]){
    const state=createGameSession(-100,77,kind);
    const screen=playGame(state,"a"+state.secret);
    assert.equal(screen.finished,true);
    assert.equal(screen.outcome,"correct_answer");
  }
});

test("word game can be solved and all game screens have navigation",()=>{
  const state=createGameSession(-100,77,"word");
  const words=["کتاب","دریا","باران","ستاره","مداد","پنجره"];
  const index=words.indexOf(state.answer);
  assert.ok(index>=0);
  const screen=playGame(state,"w"+index);
  assert.equal(screen.finished,true);
  assert.equal(screen.outcome,"win");
  assert.ok(renderGame(createGameSession(-100,77,"truth")).rows.flat().some(b=>b.callback_data.includes(":truth")));
});

test("invalid game owner and invalid game actions do not finish a session",()=>{
  assert.throws(()=>createGameSession(100,77,"rps"),/Invalid game owner/);
  const state=createGameSession(-100,77,"rps");
  const screen=playGame(state,"not-an-action");
  assert.equal(screen.finished,false);
  assert.equal(screen.outcome,null);
});

test("math and memory challenges have valid answer choices",()=>{
 for(const kind of ["math","memory"]){
  const state=createGameSession(-100,77,kind);
  const choices=state.answer.split("|");
  assert.ok(choices.length>=3);
  assert.ok(state.secret>=0&&state.secret<choices.length);
  const screen=playGame(state,"a"+state.secret);
  assert.equal(screen.outcome,"correct_answer");
 }
});

test("coin toss accepts only heads or tails and resolves the round",()=>{
 const state=createGameSession(-100,77,"coin");
 const screen=playGame(state,state.secret===0?"heads":"tails");
 assert.equal(screen.outcome,"win");
 assert.equal(screen.finished,true);
});

test("power items apply hints, extra guesses, option removal and retry",()=>{
 const number=createGameSession(-100,77,"number");
 assert.equal(applyGamePower(number,"power_extra_guess").applied,true);
 assert.equal(number.attempts,4);
 const quiz=createGameSession(-100,77,"quiz");
 const removed=applyGamePower(quiz,"power_remove_option");
 assert.equal(removed.applied,true);
 assert.equal(removed.screen.rows.flat().length,2);
 const retry=createGameSession(-100,77,"number");
 retry.attempts=1;
 assert.equal(applyGamePower(retry,"power_retry").applied,true);
 const wrong=retry.secret===1?2:1;
 const first=playGame(retry,String(wrong));
 assert.equal(first.outcome,null);
 assert.equal(retry.status,"active");
 assert.equal(retry.attempts,1);
 assert.equal(playGame(retry,String(retry.secret)).outcome,"win");
});

test("XP boost and hint items modify the active game without changing the answer",()=>{
 const quiz=createGameSession(-100,77,"quiz");
 const correct=quiz.secret;
 const hint=applyGamePower(quiz,"power_hint");
 assert.equal(hint.applied,true);
 assert.match(hint.screen.text,/راهنمایی/);
 assert.equal(quiz.secret,correct);
 assert.equal(applyGamePower(quiz,"power_xp_boost").applied,true);
 assert.equal(quiz.xpBoost,true);
});

test("truth-pass and rematch consumables have real effects",()=>{
 const truth=createGameSession(-100,77,"truth");
 assert.equal(applyGamePower(truth,"fun_truth_pass").applied,true);
 const skipped=playGame(truth,"truth");
 assert.match(skipped.text,/از این نوبت گذشتی/);
 const rematch=createGameSession(-100,77,"rps");
 const oldId=rematch.id;
 const restarted=applyGamePower(rematch,"fun_rematch");
 assert.equal(restarted.applied,true);
 assert.notEqual(rematch.id,oldId);
 assert.equal(rematch.status,"active");
});

test("every active game screen keeps a back-to-menu button",()=>{
 for(const kind of ["rps","number","quiz","word","dice","truth","emoji","coin","math","memory"]){
  const screen=renderGame(createGameSession(-100,77,kind));
  assert.ok(screen.rows.flat().some(button=>button.callback_data==="shaki_game:menu"),kind);
 }
});
