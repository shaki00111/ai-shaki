import app from "./index";
import {
  classifyLegacyKeyboardUpdate,
  removeLegacyReplyKeyboard,
} from "./legacyKeyboardGuard";

type WorkerEnv = { TOKEN?: string; WEBHOOK_SECRET?: string };
import {
  awardActivityXp, claimDailyXp, claimMissionXp, consumeXpItem, getXpMissions, getXpInventory, getXpLeaderboard, getXpProfile,
  getXpShop, purchaseXpItem, type XpItemCategory,
} from "./xpEconomy";
import type { GroupStatsDB } from "./groupStats";
import { applyGamePower, clearGameSession, createGameSession, gameMenu, loadGameSession, parseGameKind, playGame, renderGame, saveGameSession } from "./groupGames";

type XpWorkerEnv = WorkerEnv & { DB?: GroupStatsDB };
type TgMessage = { message_id:number; chat:{id:number;type:string}; from?:{id:number;is_bot?:boolean}; text?:string };
type TgCallback = { id:string; data?:string; from:{id:number}; message?:TgMessage };
type TgUpdate = { message?:TgMessage; callback_query?:TgCallback };

const XP_CATEGORIES: {id:XpItemCategory;label:string}[] = [
  {id:"title",label:"👑 لقب و پرستیژ"},
  {id:"power",label:"⚔️ قدرت بازی"},
  {id:"fun",label:"🎲 سرگرمی"},
  {id:"collectible",label:"💎 کلکسیونی"},
  {id:"ticket",label:"🎟️ بلیت و جعبه"},
];
const XP_HOME = [[{text:"👤 پروفایل من",callback_data:"shaki_xp:profile"},{text:"🛒 فروشگاه",callback_data:"shaki_xp:shop"}],
  [{text:"🎒 کوله‌پشتی",callback_data:"shaki_xp:inventory"},{text:"🏆 رتبه‌بندی",callback_data:"shaki_xp:rank"}],
  [{text:"🎁 دریافت XP روزانه",callback_data:"shaki_xp:daily"}],
  [{text:"🎯 مأموریت‌های روزانه",callback_data:"shaki_xp:missions"}]];
function xpKeyboard(rows: unknown[][]){return {inline_keyboard:rows};}
async function showXpScreen(env:XpWorkerEnv,chatId:number,userId:number,messageId:number|undefined,screen:string,category?:XpItemCategory,note=""){
  if(!env.DB||!env.TOKEN)return;
  const db=env.DB;
  let text="";
  let rows:unknown[][]=[];
  if(screen==="profile"){
    const p=await getXpProfile(db,chatId,userId);
    const owned=await getXpInventory(db,chatId,userId);
    const titles=owned.filter(x=>x.item.category==="title").map(x=>x.item.name);
    const badges=owned.filter(x=>x.item.category==="collectible").map(x=>x.item.name);
    text=(note?note+"\n\n":"")+"👤 پروفایل بازیکن\n\n⭐ موجودی XP: "+p.xp+"\n🏅 سطح: "+p.level+"\n📈 پیشرفت سطح: "+p.progress+"٪"+(titles.length?"\n👑 لقب‌ها: "+titles.join("، "):"")+(badges.length?"\n💎 افتخارات: "+badges.join("، "):"")+"\n\nبا بازی و مأموریت XP جمع کن و در فروشگاه خرجش کن.";
    rows=XP_HOME;
  }else if(screen==="shop"){
    text="🛒 فروشگاه XP شاکی\n\nیک دسته را انتخاب کن:";
    rows=XP_CATEGORIES.map(c=>[{text:c.label,callback_data:"shaki_xp:category:"+c.id}]);
    rows.push([{text:"⬅️ بازگشت به پروفایل",callback_data:"shaki_xp:profile"}]);
  }else if(screen==="category"&&category){
    const items=getXpShop(category).slice(0,8);
    text="🛍️ "+(XP_CATEGORIES.find(c=>c.id===category)?.label??"فروشگاه")+"\n\nبرای خرید محصول انتخاب کن:";
    rows=items.map(item=>[{text:item.name+" · "+item.price+" XP",callback_data:"shaki_xp:buy:"+item.id}]);
    rows.push([{text:"⬅️ دسته‌ها",callback_data:"shaki_xp:shop"},{text:"👤 پروفایل",callback_data:"shaki_xp:profile"}]);
  }else if(screen==="inventory"){
    const inventory=await getXpInventory(db,chatId,userId);
    text="🎒 کوله‌پشتی من\n\n"+(inventory.length?inventory.map(x=>"• "+x.item.name+" × "+x.quantity).join("\n"):"هنوز آیتمی نخریدی.")+"\n\nبرای استفاده از قدرت‌ها، ابتدا یک بازی را شروع کن و سپس آیتم را از اینجا فعال کن.";
    rows=inventory.filter(x=>["power_hint","power_extra_guess","power_remove_option","power_retry","power_xp_boost","power_second_chance","power_shield","fun_question_swap","fun_truth_pass","fun_rematch"].includes(x.itemId)).map(x=>[{text:"⚡ استفاده: "+x.item.name+" × "+x.quantity,callback_data:"shaki_xp:use:"+x.itemId}]);
    rows.push([{text:"🛒 فروشگاه",callback_data:"shaki_xp:shop"},{text:"👤 پروفایل",callback_data:"shaki_xp:profile"}]);
  }else if(screen==="missions"){
    const missions=await getXpMissions(db,chatId,userId);
    text="🎯 مأموریت‌های روزانه\n\n"+missions.map(m=>(m.claimed?"✅ ":m.complete?"🎁 ":"🔹 ")+m.title+" — "+m.description+" ("+m.progress+"/"+m.target+")"+(m.claimed?" · دریافت شد":m.complete?" · جایزه "+m.reward+" XP":"")).join("\n");
    rows=missions.filter(m=>m.complete).map(m=>[{text:"🎁 دریافت "+m.reward+" XP · "+m.title,callback_data:"shaki_xp:mission:"+m.id}]);
    rows.push([{text:"👤 پروفایل",callback_data:"shaki_xp:profile"},{text:"🎮 بازی‌ها",callback_data:"shaki_game:menu"}]);
  }else if(screen==="rank"){
    const list=await getXpLeaderboard(db,chatId,10);
    text="🏆 برترین بازیکنان این گروه\n\n"+(list.length?list.map((x,i)=>(i+1)+". کاربر "+x.userId+" — "+x.xp+" XP").join("\n"):"هنوز امتیازی ثبت نشده.");
    rows=[[{text:"👤 پروفایل من",callback_data:"shaki_xp:profile"},{text:"🛒 فروشگاه",callback_data:"shaki_xp:shop"}]];
  }else{
    text="⭐ سیستم XP شاکی\n\n"+note;
    rows=XP_HOME;
  }
  const params:Record<string,unknown>={chat_id:chatId,text,reply_markup:xpKeyboard(rows)};
  if(typeof messageId==="number"){
    params.message_id=messageId;
    try{await telegramCall(env.TOKEN,"editMessageText",params);return;}catch(error){
      if(String(error).includes("message is not modified"))return;
      throw error;
    }
  }
  await telegramCall(env.TOKEN,"sendMessage",params);
}
async function handleXpUpdate(update:TgUpdate,env:XpWorkerEnv):Promise<boolean>{
  if(!env.DB||!env.TOKEN)return false;
  const message=update.message;
  const callback=update.callback_query;
  if(message?.text&&message.chat.id<0&&message.chat.type!=="private"&&message.from&&!message.from.is_bot){
    const command=message.text.trim().split(/\s+/,1)[0].split("@",1)[0].toLowerCase();
    if(["/xp","/shop","/rank","/inventory","/daily","/missions"].includes(command)){
      if(command==="/daily"){
        const reward=await claimDailyXp(env.DB,message.chat.id,message.from.id);
        const note=reward.awarded?"🎁 پاداش روزانه دریافت شد: +"+reward.amount+" XP":"⏳ پاداش امروزت را قبلاً دریافت کرده‌ای.";
        await showXpScreen(env,message.chat.id,message.from.id,undefined,"profile",undefined,note);
      }else{
        const screen=command==="/shop"?"shop":command==="/rank"?"rank":command==="/inventory"?"inventory":command==="/missions"?"missions":"profile";
        await showXpScreen(env,message.chat.id,message.from.id,undefined,screen);
      }
      return true;
    }
  }
  if(callback?.data?.startsWith("shaki_xp:")&&callback.message&&callback.message.chat.id<0){
    const chatId=callback.message.chat.id,userId=callback.from.id,messageId=callback.message.message_id;
    const parts=callback.data.split(":");
    const action=parts[1];
    let notice="انجام شد";
    if(action==="use"&&parts[2]){
      const state=await loadGameSession(env.DB,chatId,userId);
      if(!state){
        notice="اول یک بازی فعال را از /games شروع کن.";
      }else{
        const applied=applyGamePower(state,parts[2]);
        if(!applied.applied){
          notice="این آیتم در بازی فعلی قابل استفاده نیست.";
        }else{
          const consumed=await consumeXpItem(env.DB,chatId,userId,parts[2],callback.id);
          if(!consumed.used){
            notice="از این آیتم در کوله‌پشتی موجود نداری.";
          }else{
            await saveGameSession(env.DB,state);
            await telegramCall(env.TOKEN,"editMessageText",{chat_id:chatId,message_id:messageId,text:applied.screen.text,reply_markup:xpKeyboard(applied.screen.rows)});
            notice="آیتم فعال شد.";
          }
        }
      }
    }else if(action==="mission"&&parts[2]){
      const result=await claimMissionXp(env.DB,chatId,userId,parts[2]);
      notice=result.awarded?"🎯 مأموریت تکمیل شد؛ +"+result.amount+" XP":"هنوز شرایط مأموریت کامل نشده یا جایزه قبلاً دریافت شده است.";
      await showXpScreen(env,chatId,userId,messageId,"missions");
    }else if(action==="daily"){
      const result=await claimDailyXp(env.DB,chatId,userId);
      notice=result.awarded?"🎁 "+result.amount+" XP دریافت کردی":"امروز پاداش روزانه‌ات را قبلاً گرفتی.";
      await showXpScreen(env,chatId,userId,messageId,"profile");
    }else if(action==="buy"&&parts[2]){
      const result=await purchaseXpItem(env.DB,chatId,userId,parts[2],callback.id);
      notice=result.purchased?"خرید انجام شد؛ "+result.item.name:"XP کافی نیست یا این آیتم را قبلاً خریده‌ای.";
      await showXpScreen(env,chatId,userId,messageId,"inventory",undefined,notice);
    }else if(action==="category"&&parts[2]){
      await showXpScreen(env,chatId,userId,messageId,"category",parts[2] as XpItemCategory);
    }else if(["shop","profile","inventory","rank","missions"].includes(action)){
      await showXpScreen(env,chatId,userId,messageId,action);
    }else{
      notice="این گزینه معتبر نیست.";
    }
    await telegramCall(env.TOKEN,"answerCallbackQuery",{callback_query_id:callback.id,text:notice,show_alert:false}).catch(()=>{});
    return true;
  }
  return false;
}


async function handleGamesUpdate(update:TgUpdate,env:XpWorkerEnv):Promise<boolean>{
  if(!env.DB||!env.TOKEN)return false;
  const message=update.message;
  const callback=update.callback_query;
  if(message?.text&&message.chat.id<0&&message.chat.type!=="private"&&message.from&&!message.from.is_bot){
    const command=message.text.trim().split(/\s+/,1)[0].split("@",1)[0].toLowerCase();
    if(command==="/games"||command==="/game"){
      const screen=gameMenu();
      await telegramCall(env.TOKEN,"sendMessage",{chat_id:message.chat.id,text:screen.text,reply_markup:xpKeyboard(screen.rows)});
      return true;
    }
  }
  if(!callback?.data?.startsWith("shaki_game:")||!callback.message||callback.message.chat.id>=0)return false;
  const chatId=callback.message.chat.id,userId=callback.from.id,messageId=callback.message.message_id;
  const parts=callback.data.split(":");
  let notice="";
  try{
    if(parts[1]==="menu"){
      await clearGameSession(env.DB,chatId,userId);
      const screen=gameMenu();
      await telegramCall(env.TOKEN,"editMessageText",{chat_id:chatId,message_id:messageId,text:screen.text,reply_markup:xpKeyboard(screen.rows)});
    }else if(parts[1]==="play"&&parts[2]==="menu"&&parts[3]){
      const kind=parseGameKind(parts[3]);
      if(!kind)throw new Error("بازی نامعتبر است.");
      const state=createGameSession(chatId,userId,kind);
      await saveGameSession(env.DB,state);
      const screen=renderGame(state);
      await telegramCall(env.TOKEN,"editMessageText",{chat_id:chatId,message_id:messageId,text:screen.text,reply_markup:xpKeyboard(screen.rows)});
    }else if(parts[1]==="play"&&parts[2]&&parts[3]){
      const state=await loadGameSession(env.DB,chatId,userId);
      if(!state||state.id!==parts[2]){
        notice="این بازی منقضی شده یا متعلق به تو نیست. /games را بزن.";
      }else{
        const screen=playGame(state,parts[3]);
        await saveGameSession(env.DB,state);
        if(screen.outcome){
          const eventId="game-"+state.id;
          const rewardReason=state.xpBoost?(screen.outcome==="win"?"boosted_win":screen.outcome==="correct_answer"?"boosted_correct_answer":"boosted_participation"):screen.outcome;
          const reward=await awardActivityXp(env.DB,chatId,userId,rewardReason,eventId);
          notice=reward.awarded?"پاداش بازی ثبت شد: +"+reward.amount+" XP":"این پاداش قبلاً ثبت شده است.";
        }
        await telegramCall(env.TOKEN,"editMessageText",{chat_id:chatId,message_id:messageId,text:screen.text,reply_markup:xpKeyboard(screen.rows)});
      }
    }
  }catch(error){
    notice=String(error).slice(0,180);
  }
  await telegramCall(env.TOKEN,"answerCallbackQuery",{callback_query_id:callback.id,text:notice||"انجام شد",show_alert:!!notice}).catch(()=>{});
  return true;
}

type ExistingWorker = {
  fetch(request: Request, env: WorkerEnv, ctx: ExecutionContext): Promise<Response>;
  scheduled?: (controller: ScheduledController, env: WorkerEnv, ctx: ExecutionContext) => void | Promise<void>;
};

const existing = app as unknown as ExistingWorker;

async function telegramCall(token: string, method: string, params: Record<string, unknown>): Promise<any> {
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(params),
  });
  const payload = await response.json() as { ok?: boolean; result?: any; description?: string };
  if (!response.ok || payload.ok !== true) {
    throw new Error(`Telegram ${method} failed: ${payload.description ?? response.status}`);
  }
  return payload.result;
}

function ok(): Response {
  return new Response('{"ok":true}', { status: 200, headers: { "content-type": "application/json" } });
}

export default {
  async fetch(request: Request, env: WorkerEnv, ctx: ExecutionContext): Promise<Response> {
    // Only trust Telegram webhook updates authenticated with the configured secret.
    if (
      request.method === "POST" &&
      env.TOKEN &&
      env.WEBHOOK_SECRET &&
      request.headers.get("X-Telegram-Bot-Api-Secret-Token") === env.WEBHOOK_SECRET
    ) {
      try {
        const update = await request.clone().json() as Parameters<typeof classifyLegacyKeyboardUpdate>[0];
        const decision = classifyLegacyKeyboardUpdate(update);
        if (decision !== "none") {
          const chatId = update.message?.chat?.id ?? update.callback_query?.message?.chat?.id;
          if (typeof chatId !== "number") return existing.fetch(request, env, ctx);
          await removeLegacyReplyKeyboard(chatId, (method, params) => telegramCall(env.TOKEN!, method, params)).catch(() => {});

          // Taps on old ReplyKeyboard buttons must never be sent to SHAKI as prompts.
          if (decision === "close") return ok();
          if (decision === "reopen") {
            update.message!.text = update.message!.chat?.type === "private" ? "/start" : "/panel";
            const headers = new Headers(request.headers);
            headers.delete("content-length");
            request = new Request(request.url, {
              method: "POST",
              headers,
              body: JSON.stringify(update),
            });
          }
        }
      } catch {
        // Malformed updates or a temporary Telegram API failure must not break the original webhook.
      }
    }

    if (request.method === "POST" && env.TOKEN && env.WEBHOOK_SECRET &&
      request.headers.get("X-Telegram-Bot-Api-Secret-Token") === env.WEBHOOK_SECRET) {
      try {
        const update = await request.clone().json() as TgUpdate;
        if (await handleGamesUpdate(update, env as XpWorkerEnv)) return ok();
        if (await handleXpUpdate(update, env as XpWorkerEnv)) return ok();
      } catch {
        // Keep the existing bot handler as the safe fallback for unrelated updates.
      }
    }

    return existing.fetch(request, env, ctx);
  },
  scheduled(controller: ScheduledController, env: WorkerEnv, ctx: ExecutionContext) {
    return existing.scheduled?.(controller, env, ctx);
  },
};
