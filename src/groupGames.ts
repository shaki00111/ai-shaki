/**
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * SHAKI group mini-games: persistent per-player sessions and edit-in-place screens.
 */
import type { GroupStatsDB } from "./groupStats";

export type GameKind = "rps" | "number" | "quiz" | "word" | "dice" | "truth" | "emoji" | "coin" | "math" | "memory";
export type GameOutcome = "win" | "correct_answer" | "participation" | null;
export interface GameSession {
  id: string; chatId: number; userId: number; kind: GameKind;
  createdAt: number; status: "active" | "finished"; secret: number;
  attempts: number; prompt: string; answer: string;
  hiddenOptions?: number[]; retryAvailable?: boolean; xpBoost?: boolean; truthPass?: boolean;
}
export interface GameScreen {
  text: string;
  rows: Array<Array<{text:string;callback_data:string}>>;
  outcome: GameOutcome;
  finished: boolean;
}
const PREFIX = "shaki:group-games:v1:";
const WORDS = [
  {word:"کتاب",scramble:"باکت"},{word:"دریا",scramble:"ایرد"},
  {word:"باران",scramble:"ناربا"},{word:"ستاره",scramble:"راتسه"},
  {word:"مداد",scramble:"دامد"},{word:"پنجره",scramble:"جرهپن"},
];
const QUIZZES = [
  {q:"کدام سیاره به سیاره سرخ معروف است؟",a:["مریخ","زهره","مشتری"],correct:0},
  {q:"بزرگ‌ترین اقیانوس جهان کدام است؟",a:["اطلس","آرام","هند"],correct:1},
  {q:"عدد ۱۲ ضربدر ۸ چند می‌شود؟",a:["۸۶","۹۶","۱۰۸"],correct:1},
  {q:"کدام حیوان پستاندار است؟",a:["کوسه","دلفین","اختاپوس"],correct:1},
  {q:"نماد شیمیایی طلا چیست؟",a:["Ag","Au","Fe"],correct:1},
  {q:"کدام قاره بیشترین کشور را دارد؟",a:["آفریقا","اروپا","آسیا"],correct:0},
];
const TRUTHS = ["آخرین باری که از ته دل خندیدی کی بود؟","یک عادت عجیب خودت را بگو.","اگر یک روز نامرئی بودی چه می‌کردی؟","بزرگ‌ترین ترست در یک جمله چیست؟"];
const DARES = ["یک جمله را فقط با ایموجی بیان کن.","اسم خودت را برعکس بنویس.","سه تعریف واقعی از یکی از اعضای گروه بکن.","تا پیام بعدی فقط با یک کلمه جواب بده."];
const EMOJI = [
  {q:"🎬🧊🚢❤️",a:["تایتانیک","ماتریکس","آواتار"],correct:0},
  {q:"🦁👑🌅",a:["شیرشاه","جومانجی","شِرِک"],correct:0},
  {q:"🕷️🧑🏙️",a:["بتمن","مرد عنکبوتی","سوپرمن"],correct:1},
  {q:"🧙‍♂️💍🌋",a:["هری پاتر","ارباب حلقه‌ها","هابیت"],correct:1},
];
function pick<T>(items: readonly T[]):T { return items[Math.floor(Math.random()*items.length)]; }
function sessionKey(chatId:number,userId:number):string {
  if(!Number.isSafeInteger(chatId)||chatId>=0||!Number.isSafeInteger(userId)||userId<=0) throw new Error("Invalid game owner");
  return PREFIX+chatId+":"+userId;
}
export async function loadGameSession(db:GroupStatsDB,chatId:number,userId:number):Promise<GameSession|null>{
  const row=await db.prepare("SELECT value_text FROM kv_store WHERE key=?").bind(sessionKey(chatId,userId)).first<{value_text:string|null}>();
  if(!row?.value_text)return null;
  try {
    const state=JSON.parse(row.value_text) as GameSession;
    if(state.chatId!==chatId||state.userId!==userId||state.status!=="active"||Date.now()-state.createdAt>3_600_000)return null;
    return state;
  } catch { return null; }
}
export async function saveGameSession(db:GroupStatsDB,state:GameSession):Promise<void>{
  await db.prepare("INSERT INTO kv_store (key,value_text,value_blob,expires_at,created_at) VALUES (?, ?, NULL, ?, ?) ON CONFLICT(key) DO UPDATE SET value_text=excluded.value_text, expires_at=excluded.expires_at, created_at=excluded.created_at")
    .bind(sessionKey(state.chatId,state.userId),JSON.stringify(state),Math.floor(state.createdAt/1000)+3600,Math.floor(Date.now()/1000)).run();
}
export async function clearGameSession(db:GroupStatsDB,chatId:number,userId:number):Promise<void>{
  await db.prepare("DELETE FROM kv_store WHERE key=?").bind(sessionKey(chatId,userId)).run();
}
export function createGameSession(chatId:number,userId:number,kind:GameKind,now=Date.now()):GameSession {
  sessionKey(chatId,userId);
  if(!Number.isFinite(now))throw new Error("Invalid game timestamp");
  const id=Math.random().toString(36).slice(2,10)+now.toString(36);
  const word=pick(WORDS), quiz=pick(QUIZZES), emoji=pick(EMOJI);
  const a=Math.floor(Math.random()*12)+3, b=Math.floor(Math.random()*9)+2, sum=a+b;
  const mathOptions=[sum,sum+2,Math.max(1,sum-3)].sort(()=>Math.random()-.5);
  const memoryOptions=["🍎","🍌","🍇","🍒"];
  const memorySequence=memoryOptions.slice().sort(()=>Math.random()-.5).slice(0,3);
  const memoryAnswer=memoryOptions.find(item=>!memorySequence.includes(item))!;
  return {
    id,chatId,userId,kind,createdAt:now,status:"active",attempts:3,
    secret:kind==="number"?Math.floor(Math.random()*6)+1:
      kind==="quiz"?quiz.correct:kind==="emoji"?emoji.correct:
      kind==="math"?mathOptions.indexOf(sum):kind==="memory"?memoryOptions.indexOf(memoryAnswer):
      kind==="coin"?Math.floor(Math.random()*2):0,
    prompt:kind==="word"?word.scramble:kind==="quiz"?quiz.q:kind==="emoji"?emoji.q:
      kind==="math"?a+" + "+b+" = ؟":kind==="memory"?"کدام میوه در دنباله جا افتاده بود؟ "+memorySequence.join(" "):kind==="coin"?"شیر یا خط؟":"",
    answer:kind==="word"?word.word:kind==="quiz"?quiz.a.join("|"):kind==="emoji"?emoji.a.join("|"):
      kind==="math"?mathOptions.join("|"):kind==="memory"?memoryOptions.join("|"):"",
  };
}
function button(text:string,id:string,action:string){return {text,callback_data:"shaki_game:play:"+id+":"+action};}
export function gameMenu():GameScreen {
  return {text:"🎮 مرکز بازی‌های شاکی\n\nیک بازی انتخاب کن؛ نتیجه و مراحل بازی در همین پیام به‌روزرسانی می‌شود.\n⭐ بردها XP دارند.",rows:[
    [button("⚔️ سنگ کاغذ قیچی","menu","rps"),button("🎯 حدس عدد","menu","number")],
    [button("🧠 اطلاعات عمومی","menu","quiz"),button("🔤 حدس کلمه","menu","word")],
    [button("🎲 تاس رقابتی","menu","dice"),button("🎭 جرئت یا حقیقت","menu","truth")],
    [button("🧩 معمای ایموجی","menu","emoji"),button("🪙 شیر یا خط","menu","coin")],
    [button("➕ چالش ریاضی","menu","math"),button("🧠 حافظه سریع","menu","memory")],
  ],outcome:null,finished:false};
}
export function renderGame(state:GameSession,note=""):GameScreen {
  const id=state.id;
  const back=[[{text:"🎮 منوی بازی‌ها",callback_data:"shaki_game:menu"}]];
  if(state.status==="finished")return {text:note+"\n\nبازی تمام شد! برای بازی دوباره به منو برگرد.",rows:back,outcome:null,finished:true};
  if(state.kind==="rps")return {text:"⚔️ سنگ، کاغذ، قیچی\n\nحرکتت رو انتخاب کن:",rows:[[button("✊ سنگ",id,"rock"),button("✋ کاغذ",id,"paper"),button("✌️ قیچی",id,"scissors")],...back],outcome:null,finished:false};
  if(state.kind==="number")return {text:"🎯 حدس عدد\n\nیک عدد بین ۱ تا ۶ انتخاب کن. سه فرصت داری.\n"+note+"\nفرصت باقی‌مانده: "+state.attempts,rows:[...[ [1,2,3],[4,5,6] ].map(group=>group.map(n=>button(String(n),id,String(n)))),...back],outcome:null,finished:false};
  if(["quiz","emoji","math","memory"].includes(state.kind)){
    const answers=state.answer.split("|");
    const hidden=new Set(state.hiddenOptions??[]);
    const visible=answers.map((answer,index)=>({answer,index})).filter(item=>!hidden.has(item.index));
    const heading=state.kind==="quiz"?"🧠 مسابقه اطلاعات عمومی":state.kind==="emoji"?"🧩 معمای ایموجی":state.kind==="math"?"➕ چالش ریاضی":"🧠 حافظه سریع";
    return {text:heading+"\n\n"+state.prompt+"\n\n"+visible.map(item=>(item.index+1)+". "+item.answer).join("\n"),rows:[...visible.map(item=>[button("گزینه "+(item.index+1),id,"a"+item.index)]),...back],outcome:null,finished:false};
  }
  if(state.kind==="word")return {text:"🔤 حدس کلمه\n\nحروف به‌هم‌ریخته: "+state.prompt+"\n\nجوابت رو انتخاب کن:",rows:[[{text:"کتاب",callback_data:"shaki_game:play:"+id+":w0"},{text:"دریا",callback_data:"shaki_game:play:"+id+":w1"}],[{text:"باران",callback_data:"shaki_game:play:"+id+":w2"},{text:"ستاره",callback_data:"shaki_game:play:"+id+":w3"}],[{text:"مداد",callback_data:"shaki_game:play:"+id+":w4"},{text:"پنجره",callback_data:"shaki_game:play:"+id+":w5"}],...back],outcome:null,finished:false};
  if(state.kind==="coin")return {text:"🪙 شیر یا خط\n\nحدست رو انتخاب کن:",rows:[[button("شیر",id,"heads"),button("خط",id,"tails")],...back],outcome:null,finished:false};
  if(state.kind==="dice")return {text:"🎲 تاس رقابتی\n\nحدس بزن تاس تو از تاس SHAKI بیشتر می‌شود یا کمتر؟",rows:[[button("بیشتر می‌شود ⬆️",id,"high"),button("کمتر می‌شود ⬇️",id,"low")],...back],outcome:null,finished:false};
  return {text:"🎭 جرئت یا حقیقت\n\nیکی رو انتخاب کن:",rows:[[button("🗣️ حقیقت",id,"truth"),button("🔥 جرئت",id,"dare")],...back],outcome:null,finished:false};
}
export function applyGamePower(state:GameSession,itemId:string):{applied:boolean;screen:GameScreen}{
  if(state.status!=="active")return {applied:false,screen:renderGame(state,"اول یک بازی فعال شروع کن.")};
  const multiple=["quiz","emoji","math","memory"].includes(state.kind);
  if(itemId==="power_hint"){
    let hint="راهنمایی: ";
    if(state.kind==="number")hint+=state.secret%2===0?"عدد زوج است.":"عدد فرد است.";
    else if(state.kind==="word")hint+="کلمه با «"+state.answer.slice(0,1)+"» شروع می‌شود.";
    else if(multiple)hint+="پاسخ درست با «"+(state.answer.split("|")[state.secret]??"").slice(0,1)+"» شروع می‌شود.";
    else return {applied:false,screen:renderGame(state,"این راهنما برای این بازی کاربرد ندارد.")};
    const screen=renderGame(state);
    return {applied:true,screen:{...screen,text:screen.text+"\n\n💡 "+hint}};
  }
  if(itemId==="power_extra_guess"){
    if(state.kind!=="number"||state.attempts>=5)return {applied:false,screen:renderGame(state,"حدس اضافه فقط برای حدس عدد کاربرد دارد یا سقف فرصت‌ها پر است.")};
    state.attempts++;
    return {applied:true,screen:renderGame(state,"⚡ یک فرصت حدس اضافه گرفتی.")};
  }
  if(itemId==="power_remove_option"){
    if(!multiple||(state.hiddenOptions?.length??0)>=1)return {applied:false,screen:renderGame(state,"حذف گزینه فقط یک بار در کوئیز، معما، ریاضی یا حافظه قابل استفاده است.")};
    const wrong=state.answer.split("|").map((_,i)=>i).filter(i=>i!==state.secret);
    const hide=pick(wrong);
    state.hiddenOptions=[...(state.hiddenOptions??[]),hide];
    return {applied:true,screen:renderGame(state,"🧩 یک گزینه اشتباه حذف شد.")};
  }
  if(itemId==="power_retry"||itemId==="power_second_chance"||itemId==="power_shield"){
    if(state.retryAvailable)return {applied:false,screen:renderGame(state,"فرصت دوباره این بازی قبلاً فعال شده است.")};
    state.retryAvailable=true;
    return {applied:true,screen:renderGame(state,"🛡️ فرصت دوباره فعال شد؛ اگر اشتباه کنی یک بار دیگر تلاش می‌کنی.")};
  }
  if(itemId==="power_xp_boost"){
    if(state.xpBoost)return {applied:false,screen:renderGame(state,"تقویت XP برای این بازی قبلاً فعال شده است.")};
    state.xpBoost=true;
    return {applied:true,screen:renderGame(state,"⚡ پاداش XP این بازی دو برابر می‌شود.")};
  }
  if(itemId==="fun_truth_pass"){
    if(state.kind!=="truth")return {applied:false,screen:renderGame(state,"کارت عبور فقط در جرئت یا حقیقت کاربرد دارد.")};
    state.truthPass=true;
    return {applied:true,screen:renderGame(state,"🎟️ کارت عبور آماده شد؛ می‌توانی از نوبت رد شوی.")};
  }
  if(itemId==="fun_rematch"){
    const fresh=createGameSession(state.chatId,state.userId,state.kind);
    Object.assign(state,fresh);
    return {applied:true,screen:renderGame(state,"🔁 بازی دوباره شروع شد.")};
  }
  if(itemId==="fun_question_swap"&&multiple){
    if(state.kind==="quiz"){const q=pick(QUIZZES);state.prompt=q.q;state.answer=q.a.join("|");state.secret=q.correct;}
    else if(state.kind==="emoji"){const q=pick(EMOJI);state.prompt=q.q;state.answer=q.a.join("|");state.secret=q.correct;}
    else return {applied:false,screen:renderGame(state,"تعویض سؤال برای این بازی در دسترس نیست.")};
    state.hiddenOptions=[];
    return {applied:true,screen:renderGame(state,"🔄 سؤال جدید جایگزین شد.")};
  }
  return {applied:false,screen:renderGame(state,"این آیتم در بازی فعلی قابل استفاده نیست.")};
}

export function playGame(state:GameSession,action:string):GameScreen {
  if(state.status!=="active")return renderGame(state,"این بازی قبلاً تمام شده.");
  let outcome:GameOutcome=null, note="";
  if(state.kind==="rps"){
    if(!["rock","paper","scissors"].includes(action))return renderGame(state);
    const bot=pick(["rock","paper","scissors"] as const);
    const win=(action==="rock"&&bot==="scissors")||(action==="paper"&&bot==="rock")||(action==="scissors"&&bot==="paper");
    const draw=action===bot; outcome=win?"win":"participation";
    const names:Record<string,string>={rock:"سنگ",paper:"کاغذ",scissors:"قیچی"};
    note="انتخاب تو: "+names[action]+"\nانتخاب SHAKI: "+names[bot]+"\n"+(win?"🏆 بردی! +۳۰ XP":draw?"🤝 مساوی شد؛ +۵ XP":"این دور رو باختی؛ +۵ XP");
  }else if(state.kind==="number"){
    const guess=Number(action);
    if(!Number.isInteger(guess)||guess<1||guess>6)return renderGame(state,"انتخاب نامعتبر است.");
    if(guess===state.secret){outcome="win";note="🎯 درست حدس زدی! عدد "+state.secret+" بود؛ +۳۰ XP";}
    else {state.attempts--;if(state.attempts<=0){outcome="participation";note="فرصت‌ها تمام شد؛ عدد "+state.secret+" بود. +۵ XP";}else note=(guess<state.secret?"عدد بزرگ‌تره.":"عدد کوچک‌تره.")+" دوباره تلاش کن.";}
  }else if(["quiz","emoji","math","memory"].includes(state.kind)){
    const match=action.match(/^a([0-3])$/);if(!match)return renderGame(state,"گزینه نامعتبر است.");
    const correct=Number(match[1])===state.secret;outcome=correct?"correct_answer":"participation";
    note=correct?"✅ پاسخ درست بود! +۱۰ XP":"❌ پاسخ درست نبود. +۵ XP";
  }else if(state.kind==="word"){
    const match=action.match(/^w([0-5])$/);if(!match)return renderGame(state,"گزینه نامعتبر است.");
    const words=WORDS;const correct=words[Number(match[1])].word===state.answer;
    outcome=correct?"win":"participation";note=correct?"🔤 آفرین! کلمه رو پیدا کردی؛ +۳۰ XP":"جواب درست نبود؛ +۵ XP";
  }else if(state.kind==="coin"){
    if(action!=="heads"&&action!=="tails")return renderGame(state);
    const win=(action==="heads"?0:1)===state.secret;outcome=win?"win":"participation";
    note=win?"🪙 درست حدس زدی! +۳۰ XP":"این بار درست نشد؛ +۵ XP";
  }else if(state.kind==="dice"){
    if(action!=="high"&&action!=="low")return renderGame(state);
    const you=Math.floor(Math.random()*6)+1,bot=Math.floor(Math.random()*6)+1;
    const win=you!==bot&&(action==="high"?you>bot:you<bot);
    outcome=win?"win":"participation";
    note="تاس تو: "+you+" | تاس SHAKI: "+bot+"\n"+(win?"🏆 برنده شدی! +۳۰ XP":you===bot?"🤝 مساوی شد؛ +۵ XP":"این دور رو باختی؛ +۵ XP");
  }else if(state.kind==="truth"){
    if(action!=="truth"&&action!=="dare")return renderGame(state);
    note=state.truthPass?"🎟️ کارت عبور استفاده شد؛ از این نوبت گذشتی.":(action==="truth"?"🗣️ حقیقت: ":"🔥 جرئت: ")+pick(action==="truth"?TRUTHS:DARES);
    outcome="participation";
  }
  if(outcome&&state.retryAvailable&&outcome!=="win"){state.retryAvailable=false;if(state.kind==="number")state.attempts=1;return {...renderGame(state,"🛟 کارت فرصت دوباره مصرف شد؛ یک بار دیگر امتحان کن.\n\n"+note),outcome:null,finished:false};}
  if(outcome){state.status="finished";return {text:note,rows:[[{text:"🎮 بازی دوباره",callback_data:"shaki_game:menu"}]],outcome,finished:true};}
  return renderGame(state,note);
}
export function parseGameKind(value:string):GameKind|null {
  return (["rps","number","quiz","word","dice","truth","emoji","coin","math","memory"] as string[]).includes(value)?value as GameKind:null;
}
