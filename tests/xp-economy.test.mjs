import test from "node:test";
import assert from "node:assert/strict";
import { awardActivityXp, claimDailyXp, getXpInventory, getXpShop, purchaseXpItem, XP_DAILY_CAP, XP_REWARDS } from "../src/xpEconomy.ts";

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
  {key:prefix+"buy-collect_gold--p3"},
  {key:prefix+"earn-win-game1"},
 ]});
 const inventory=await getXpInventory(db,-100,7);
 assert.deepEqual(inventory.map(x=>[x.itemId,x.quantity]),[["collect_gold",1],["ticket_daily_box",2]]);
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
