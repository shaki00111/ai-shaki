import test from "node:test";
import assert from "node:assert/strict";
import { awardGroupXp, getGroupLeaderboard, getGroupPlayerScore } from "../src/groupStats.ts";
function fakeDb({changes=1,rows=[],sum=35}={}) {
 const calls=[];
 return {calls,prepare(sql){return {bind(...values){return {
  async run(){calls.push({kind:"run",sql,values});return {meta:{changes}};},
  async first(){calls.push({kind:"first",sql,values});return {xp:sum};},
  async all(){calls.push({kind:"all",sql,values});return {results:rows};}
 };}};}};
}
test("XP ledger stores a unique per-group event row",async()=>{
 const db=fakeDb({sum:35});
 const result=await awardGroupXp(db,-100123,77,10,"callback-abc",1_800_000_000_000);
 assert.deepEqual(result,{awarded:true,xp:35});
 assert.match(db.calls[0].sql,/ON CONFLICT\(key\) DO NOTHING/);
 assert.deepEqual(db.calls[0].values,["shaki:group-xp:v1:-100123:event:77:callback-abc","10",1_800_000_000]);
});
test("duplicate Telegram retry does not award twice",async()=>{
 const db=fakeDb({changes:0,sum:20});
 assert.deepEqual(await awardGroupXp(db,-100123,77,10,"same-event"),{awarded:false,xp:20});
});
test("XP validates group, user, amount and event",async()=>{
 const db=fakeDb();
 for(const amount of [0,-1,101,1.5,NaN]) await assert.rejects(awardGroupXp(db,-100,7,amount,"event"),/Invalid XP amount/);
 await assert.rejects(awardGroupXp(db,100,7,1,"event"),/group chat id/);
 await assert.rejects(awardGroupXp(db,-100,0,1,"event"),/user id/);
 await assert.rejects(awardGroupXp(db,-100,7,1,""),/event id/);
 assert.equal(db.calls.length,0);
});
test("score query is scoped to one group and one user",async()=>{
 const db=fakeDb({sum:123});
 assert.equal(await getGroupPlayerScore(db,-999,12),123);
 assert.deepEqual(db.calls[0].values,["shaki:group-xp:v1:-999:event:12:","shaki:group-xp:v1:-999:event:12:\uffff"]);
});
test("leaderboard aggregates event ledger by user and caps results",async()=>{
 const prefix="shaki:group-xp:v1:-55:event:";
 const db=fakeDb({rows:[
  {key:prefix+"2:ev1",value_text:"90"},
  {key:prefix+"1:ev2",value_text:"40"},
  {key:prefix+"2:ev3",value_text:"10"},
  {key:prefix+"bad:ev4",value_text:"999"},
 ]});
 const rows=await getGroupLeaderboard(db,-55,500);
 assert.deepEqual(rows,[{userId:2,xp:100},{userId:1,xp:40}]);
 assert.deepEqual(db.calls[0].values,[prefix,prefix+"\uffff"]);
});
