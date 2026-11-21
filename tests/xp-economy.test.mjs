import test from "node:test";
import assert from "node:assert/strict";
import { awardActivityXp, claimDailyXp, claimMissionXp, consumeXpItem, getXpMissions, getXpInventory, getXpShop, purchaseXpItem, XP_DAILY_CAP, XP_REWARDS } from "../src/xpEconomy.ts";

function fakeDb({changes=1,xp=0,rows=[]}={}){
 const calls=[];
 return {calls,prepare(sql){return {bind(...values){return {
  async run(){calls.push({kind:"run",sql,values});return {meta:{changes}};},
  async first(){calls.push({kind:"first",sql,values});return {xp};},
  async all(){calls.push({kind:"all",sql,values});return {results:rows};}
 };}};}};
}
test("XP rewards are fixed by activity type and bounded by a daily cap",async()=>{
 const db=fakeDb({xp:35});
 const result=await awardActivityXp(db,-100123,77,"win","game-123",1_800_000_000_000);
 assert.equal(result.awarded,true);
 assert.equal(result.amount,XP_REWARDS.win);
 assert.equal(result.xp,35);
 assert.match(db.calls[0].sql,/created_at>=\? AND created_at<\?/);
 assert.match(db.calls[0].sql,/ON CONFLICT\(key\) DO NOTHING/);
 assert.equal(db.calls[0].values.at(-1),XP_DAILY_CAP);
 assert.equal(db.calls[0].values[0],"shaki:group-xp:v1:-100123:event:77:earn-win-game-123");
});
test("duplicate XP event is idempotent",async()=>{
 const db=fakeDb({changes:0,xp:10});
 const result=await awardActivityXp(db,-100,7,"participation","same-update");
 assert.deepEqual({awarded:result.awarded,amount:result.amount,xp:result.xp},{awarded:false,amount:0,xp:10});
});
test("daily reward is unique per UTC date",async()=>{
 const db=fakeDb({changes:0});
 await claimDailyXp(db,-100,7,Date.UTC(2026,10,21,12));
 assert.match(db.calls[0].values[0],/earn-daily_login-20261121$/);
});
test("XP shop has many text-first products across categories",()=>{
 const all=getXpShop();
 assert.ok(all.length>=25);
 for(const item of all) assert.ok(item.name&&item.description&&item.effect&&item.price>0);
 assert.ok(getXpShop("power").length>=5);
});
test("purchase is an atomic balance-checked ledger insert and permanent items cannot be duplicated",async()=>{
 const db=fakeDb({changes:0,xp:400});
 const result=await purchaseXpItem(db,-100,7,"collect_gold","retry-1");
 assert.equal(result.purchased,false);
 assert.match(db.calls[0].sql,/SUM\(CAST\(value_text AS INTEGER\)\)/);
 assert.match(db.calls[0].sql,/NOT EXISTS/);
 assert.equal(db.calls[0].values[1],"-3200");
 assert.equal(db.calls[0].values[5],3200);
});
test("inventory is reconstructed from durable purchase ledger rows",async()=>{
 const prefix="shaki:group-xp:v1:-100:event:7:";
 const db=fakeDb({rows:[
  {key:prefix+"buy-ticket_daily_box--p1"},
  {key:prefix+"buy-ticket_daily_box--p2"},
  {key:prefix+"use-ticket_daily_box--u1"},
  {key:prefix+"buy-collect_gold--p3"},
  {key:prefix+"earn-win-game1"},
 ]});
 const inventory=await getXpInventory(db,-100,7);
 assert.deepEqual(inventory.map(x=>[x.itemId,x.quantity]),[["collect_gold",1],["ticket_daily_box",1]]);
});
test("invalid group, user, reason, event and item are rejected before writes",async()=>{
 const db=fakeDb();
 await assert.rejects(awardActivityXp(db,100,7,"win","e"),/group chat id/);
 await assert.rejects(awardActivityXp(db,-100,0,"win","e"),/user id/);
 await assert.rejects(awardActivityXp(db,-100,7,"invalid","e"),/XP reason/);
 await assert.rejects(awardActivityXp(db,-100,7,"win","bad:event"),/event id/);
 await assert.rejects(purchaseXpItem(db,-100,7,"not-real","p"),/Unknown shop item/);
 assert.equal(db.calls.length,0);
});

test("daily missions derive progress from verified game reward ledger events",async()=>{
 const prefix="shaki:group-xp:v1:-100:event:7:";
 const now=Date.UTC(2026,10,21,12);
 const dayStart=Math.floor(now/86_400_000)*86400;
 const db=fakeDb({rows:[
  {key:prefix+"earn-win-game-one",created_at:dayStart+10},
  {key:prefix+"earn-correct_answer-game-two",created_at:dayStart+20},
  {key:prefix+"earn-correct_answer-game-three",created_at:dayStart+30},
  {key:prefix+"earn-correct_answer-game-four",created_at:dayStart+40},
 ]});
 const missions=await getXpMissions(db,-100,7,now);
 assert.deepEqual(missions.map(m=>[m.id,m.progress,m.complete]),[
  ["play_one",1,true],["win_one",1,true],["correct_three",3,true],
 ]);
});

test("mission claims reject incomplete work and award only validated completed missions",async()=>{
 const prefix="shaki:group-xp:v1:-100:event:7:";
 const now=Date.UTC(2026,10,21,12);
 const dayStart=Math.floor(now/86_400_000)*86400;
 const incomplete=fakeDb({xp:10});
 const denied=await claimMissionXp(incomplete,-100,7,"win_one",now);
 assert.equal(denied.awarded,false);
 assert.equal(denied.amount,0);
 const complete=fakeDb({xp:60,rows:[{key:prefix+"earn-win-game-one",created_at:dayStart+10}]});
 const claimed=await claimMissionXp(complete,-100,7,"win_one",now);
 assert.equal(claimed.awarded,true);
 assert.equal(claimed.amount,XP_REWARDS.mission);
});

test("consumable item use is recorded once and requires a prior purchase",async()=>{
 const db=fakeDb({changes:1});
 const used=await consumeXpItem(db,-100,7,"power_hint","callback-1",1_800_000_000_000);
 assert.equal(used.used,true);
 assert.match(db.calls[0].sql,/SELECT COUNT\(\*\)/);
 assert.match(db.calls[0].sql,/ON CONFLICT\(key\) DO NOTHING/);
 assert.equal(db.calls[0].values[0],"shaki:group-xp:v1:-100:event:7:use-power_hint--callback-1");
});

test("XP mission and inventory SQL use complete Unicode key-range boundaries",async()=>{
 const prefix="shaki:group-xp:v1:-100:event:7:";
 const db=fakeDb({rows:[]});
 await getXpMissions(db,-100,7,Date.UTC(2026,10,21,12));
 assert.equal(db.calls[0].values[1],prefix+"earn-"+String.fromCharCode(65535));
 const useDb=fakeDb({changes:1});
 await consumeXpItem(useDb,-100,7,"power_hint","use-2");
 assert.equal(useDb.calls[0].values[3],prefix+"buy-power_hint--"+String.fromCharCode(65535));
 assert.equal(useDb.calls[0].values[5],prefix+"use-power_hint--"+String.fromCharCode(65535));
});
