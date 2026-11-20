import { getGroupPlayerScore, getGroupLeaderboard, type GroupStatsDB, type GroupPlayerScore } from "./groupStats";

export type XpReason = "participation" | "win" | "correct_answer" | "daily_login" | "mission" | "tournament";
export type XpItemCategory = "title" | "power" | "fun" | "collectible" | "ticket";
export interface XpShopItem {
  id: string; name: string; description: string; category: XpItemCategory;
  price: number; stackable: boolean; effect: string;
}
export interface XpInventoryItem { itemId: string; quantity: number; item: XpShopItem; }

export const XP_DAILY_CAP = 500;
export const XP_REWARDS: Readonly<Record<XpReason, number>> = Object.freeze({
  participation: 5, win: 30, correct_answer: 10, daily_login: 20, mission: 50, tournament: 100,
});

export const XP_SHOP_ITEMS: readonly XpShopItem[] = Object.freeze([
  { id:"title_legend",name:"لقب افسانه",description:"نمایش لقب افسانه کنار نام بازیکن",category:"title",price:2500,stackable:false,effect:"profile_title:legend" },
  { id:"title_king",name:"لقب سلطان گروه",description:"عنوان ویژه در پروفایل و رتبه‌بندی",category:"title",price:4000,stackable:false,effect:"profile_title:king" },
  { id:"title_hunter",name:"شکارچی XP",description:"لقب مخصوص جمع‌کننده‌های امتیاز",category:"title",price:1200,stackable:false,effect:"profile_title:hunter" },
  { id:"title_unbeaten",name:"شکست‌ناپذیر",description:"عنوان افتخاری بازیکن رقابتی",category:"title",price:3000,stackable:false,effect:"profile_title:unbeaten" },
  { id:"title_trickster",name:"استاد شیطنت",description:"لقب سرگرمی برای پروفایل",category:"title",price:900,stackable:false,effect:"profile_title:trickster" },
  { id:"power_hint",name:"راهنمای طلایی",description:"یک راهنمایی در بازی‌های پشتیبانی‌شده",category:"power",price:350,stackable:true,effect:"game_hint:1" },
  { id:"power_extra_guess",name:"حدس اضافه",description:"یک فرصت حدس بیشتر در بازی‌های پشتیبانی‌شده",category:"power",price:500,stackable:true,effect:"extra_guess:1" },
  { id:"power_remove_option",name:"حذف گزینه",description:"حذف یک گزینه غلط در کوئیزهای پشتیبانی‌شده",category:"power",price:450,stackable:true,effect:"remove_option:1" },
  { id:"power_retry",name:"فرصت دوباره",description:"امکان تلاش مجدد در بازی‌های پشتیبانی‌شده",category:"power",price:700,stackable:true,effect:"retry:1" },
  { id:"power_xp_boost",name:"تقویت XP",description:"افزایش پاداش یک بازی واجد شرایط؛ با سقف روزانه",category:"power",price:1800,stackable:true,effect:"xp_boost:1" },
  { id:"power_shield",name:"محافظ امتیاز",description:"محافظت از امتیاز در بازی‌هایی که این قابلیت را دارند",category:"power",price:900,stackable:true,effect:"score_shield:1" },
  { id:"power_second_chance",name:"نجات نهایی",description:"یک بار نجات از حذف در بازی‌های پشتیبانی‌شده",category:"power",price:1100,stackable:true,effect:"save_from_elimination:1" },
  { id:"fun_duel",name:"دعوت دوئل",description:"ساخت یک چالش دوئل با عضو گروه",category:"fun",price:600,stackable:true,effect:"create_duel:1" },
  { id:"fun_rematch",name:"درخواست انتقام",description:"درخواست بازی مجدد از حریف",category:"fun",price:300,stackable:true,effect:"rematch:1" },
  { id:"fun_truth_pass",name:"کارت عبور",description:"رد کردن یک نوبت جرئت یا حقیقت در صورت پشتیبانی بازی",category:"fun",price:800,stackable:true,effect:"truth_pass:1" },
  { id:"fun_question_swap",name:"تعویض سؤال",description:"تعویض سؤال در بازی‌های پشتیبانی‌شده",category:"fun",price:400,stackable:true,effect:"question_swap:1" },
  { id:"fun_challenge",name:"چالش اختصاصی",description:"ساخت یک چالش متنی برای گروه",category:"fun",price:1300,stackable:true,effect:"custom_challenge:1" },
  { id:"fun_lucky_spin",name:"گردونه ویژه",description:"یک بار چرخش گردونه جایزه",category:"fun",price:1000,stackable:true,effect:"lucky_spin:1" },
  { id:"collect_bronze",name:"مدال برنز",description:"نشان کلکسیونی در پروفایل",category:"collectible",price:500,stackable:false,effect:"badge:bronze" },
  { id:"collect_silver",name:"مدال نقره",description:"نشان کلکسیونی در پروفایل",category:"collectible",price:1400,stackable:false,effect:"badge:silver" },
  { id:"collect_gold",name:"مدال طلا",description:"نشان کلکسیونی در پروفایل",category:"collectible",price:3200,stackable:false,effect:"badge:gold" },
  { id:"collect_champion",name:"جام قهرمانی",description:"یادبود دائمی قهرمانی",category:"collectible",price:6000,stackable:false,effect:"trophy:champion" },
  { id:"collect_streak",name:"نشان وفاداری",description:"یادبود حضور پیوسته",category:"collectible",price:1600,stackable:false,effect:"badge:loyal" },
  { id:"collect_100wins",name:"نشان صد برد",description:"نشان افتخاری کلکسیون",category:"collectible",price:7500,stackable:false,effect:"badge:100_wins" },
  { id:"ticket_tournament",name:"بلیت تورنمنت",description:"ورود به یک تورنمنت پشتیبانی‌شده",category:"ticket",price:2200,stackable:true,effect:"tournament_ticket:1" },
  { id:"ticket_private",name:"اتاق رقابت خصوصی",description:"ساخت یک رقابت خصوصی در گروه",category:"ticket",price:3500,stackable:true,effect:"private_match:1" },
  { id:"ticket_daily_box",name:"جعبه روزانه",description:"دریافت یک جایزه تصادفی از جدول جوایز",category:"ticket",price:750,stackable:true,effect:"daily_box:1" },
  { id:"ticket_rare_box",name:"جعبه کمیاب",description:"شانس دریافت آیتم کلکسیونی یا مصرفی",category:"ticket",price:2800,stackable:true,effect:"rare_box:1" },
  { id:"ticket_mystery",name:"جعبه اسرارآمیز",description:"جایزه تصادفی از فهرست محدود",category:"ticket",price:5200,stackable:true,effect:"mystery_box:1" },
  { id:"ticket_name_color",name:"رنگ نام ویژه",description:"عنوان رنگی متنی در نمایش‌های پشتیبانی‌شده",category:"title",price:1900,stackable:false,effect:"name_style:neon" },
]);

const PREFIX = "shaki:group-xp:v1:";
const DAY = 86_400_000;
function validGroup(chatId:number){if(!Number.isSafeInteger(chatId)||chatId>=0)throw new Error("A Telegram group chat id is required");}
function validUser(userId:number){if(!Number.isSafeInteger(userId)||userId<=0)throw new Error("A valid Telegram user id is required");}
function safePart(value:string,label:string,max=80){const s=String(value??"").trim();if(!s||s.length>max||!/^[a-zA-Z0-9_-]+$/.test(s))throw new Error("Invalid "+label);return s;}
function ledgerPrefix(chatId:number,userId:number){validGroup(chatId);validUser(userId);return `${PREFIX}${chatId}:event:${userId}:`;}
function levelForXp(xp:number){
  const safe=Math.max(0,Math.floor(Number(xp)||0));
  let level=1;
  while(level<100 && safe>=50*level*(level+1)) level++;
  const current=50*(level-1)*level;
  const next=level>=100?current:50*level*(level+1);
  return {level,currentLevelXp:current,nextLevelXp:next,progress:level>=100?100:Math.max(0,Math.min(100,Math.floor((safe-current)/(next-current)*100)))};
}
export async function getXpProfile(db:GroupStatsDB,chatId:number,userId:number){
  const xp=await getGroupPlayerScore(db,chatId,userId);
  return {userId,xp,...levelForXp(xp)};
}
export function getXpShop(category?:XpItemCategory){return XP_SHOP_ITEMS.filter(item=>!category||item.category===category);}
export async function awardActivityXp(db:GroupStatsDB,chatId:number,userId:number,reason:XpReason,eventId:string,now=Date.now()){
  const amount=XP_REWARDS[reason];
  if(!amount)throw new Error("Invalid XP reason");
  if(!Number.isFinite(now))throw new Error("Invalid timestamp");
  const event=safePart(eventId,"event id",80);
  const prefix=ledgerPrefix(chatId,userId);
  const key=prefix+`earn-${reason}-${event}`;
  const seconds=Math.floor(now/1000);
  const dayStart=Math.floor(now/DAY)*86400;
  const dayEnd=dayStart+86400;
  const earnPrefix=prefix+"earn-";
  const result=await db.prepare(`INSERT INTO kv_store (key,value_text,value_blob,expires_at,created_at)
    SELECT ?, ?, NULL, NULL, ?
    WHERE NOT EXISTS (SELECT 1 FROM kv_store WHERE key=?)
      AND COALESCE((SELECT SUM(CAST(value_text AS INTEGER)) FROM kv_store
        WHERE key>=? AND key<? AND created_at>=? AND created_at<?),0) + ? <= ?
    ON CONFLICT(key) DO NOTHING`)
    .bind(key,String(amount),seconds,key,earnPrefix,earnPrefix+"\uffff",dayStart,dayEnd,amount,XP_DAILY_CAP).run();
  const xp=await getGroupPlayerScore(db,chatId,userId);
  return {awarded:Number(result.meta?.changes??0)>0,amount:Number(result.meta?.changes??0)>0?amount:0,xp,...levelForXp(xp)};
}
export async function claimDailyXp(db:GroupStatsDB,chatId:number,userId:number,now=Date.now()){
  const date=new Date(now);
  if(!Number.isFinite(date.getTime()))throw new Error("Invalid timestamp");
  return awardActivityXp(db,chatId,userId,"daily_login",date.toISOString().slice(0,10).replace(/-/g,""),now);
}
export async function claimMissionXp(db:GroupStatsDB,chatId:number,userId:number,missionId:string,now=Date.now()){
  const day=new Date(now);
  if(!Number.isFinite(day.getTime()))throw new Error("Invalid timestamp");
  const mission=safePart(missionId,"mission id",50);
  return awardActivityXp(db,chatId,userId,"mission",mission+"-"+day.toISOString().slice(0,10).replace(/-/g,""),now);
}
export async function purchaseXpItem(db:GroupStatsDB,chatId:number,userId:number,itemId:string,purchaseId:string,now=Date.now()){
  const item=XP_SHOP_ITEMS.find(x=>x.id===itemId);
  if(!item)throw new Error("Unknown shop item");
  if(!Number.isFinite(now))throw new Error("Invalid timestamp");
  const purchase=safePart(purchaseId,"purchase id",60);
  const prefix=ledgerPrefix(chatId,userId);
  const key=prefix+`buy-${item.id}--${purchase}`;
  const itemPrefix=prefix+`buy-${item.id}--`;
  const result=await db.prepare(`INSERT INTO kv_store (key,value_text,value_blob,expires_at,created_at)
    SELECT ?, ?, NULL, NULL, ?
    WHERE COALESCE((SELECT SUM(CAST(value_text AS INTEGER)) FROM kv_store WHERE key>=? AND key<?),0) >= ?
      AND (? = 1 OR NOT EXISTS (SELECT 1 FROM kv_store WHERE key>=? AND key<?))
    ON CONFLICT(key) DO NOTHING`)
    .bind(key,String(-item.price),Math.floor(now/1000),prefix,prefix+"\uffff",item.price,item.stackable?1:0,itemPrefix,itemPrefix+"\uffff").run();
  const xp=await getGroupPlayerScore(db,chatId,userId);
  return {purchased:Number(result.meta?.changes??0)>0,item,xp,...levelForXp(xp)};
}
export async function getXpInventory(db:GroupStatsDB,chatId:number,userId:number):Promise<XpInventoryItem[]>{
  const prefix=ledgerPrefix(chatId,userId);
  const result=await db.prepare("SELECT key FROM kv_store WHERE key>=? AND key<?").bind(prefix,prefix+"\uffff").all<{key:string}>();
  const counts=new Map<string,number>();
  for(const row of result.results??[]){
    const match=/^buy-([a-z0-9_-]+)--[a-zA-Z0-9_-]+$/.exec(row.key.slice(prefix.length));
    if(match)counts.set(match[1],(counts.get(match[1])??0)+1);
  }
  return [...counts].map(([itemId,quantity])=>({itemId,quantity,item:XP_SHOP_ITEMS.find(x=>x.id===itemId)!})).filter(x=>x.item).sort((a,b)=>a.item.category.localeCompare(b.item.category)||a.item.price-b.item.price);
}
export async function getXpLeaderboard(db:GroupStatsDB,chatId:number,limit=10):Promise<GroupPlayerScore[]>{
  return getGroupLeaderboard(db,chatId,limit);
}
