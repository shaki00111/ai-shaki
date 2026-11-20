import { dailyChallengeText } from "./dailyChallenge";
import { dailyQuiz, sendGroupQuiz } from "./groupQuiz";
import { awardGroupXp, getGroupLeaderboard, type GroupStatsDB } from "./groupStats";

export interface ShakiTelegramEnv {
  TOKEN?: string;
  WEBHOOK_SECRET?: string;
  BOT_OWNER_ID?: string;
  DB?: GroupStatsDB;
}

type TelegramUpdate = {
  message?: {
    message_id: number;
    text?: string;
    chat: { id: number; type: string; title?: string };
    from?: { id: number; first_name?: string; username?: string };
    new_chat_members?: Array<{ id: number; is_bot?: boolean; first_name?: string; username?: string }>;
  };
  callback_query?: {
    id: string;
    data?: string;
    from: { id: number; first_name?: string };
    message?: { message_id: number; chat: { id: number; type: string } };
  };
};

export type TelegramCall = (method: string, params: Record<string, unknown>) => Promise<any>;

const MAIN_KEYBOARD = [
  ["🎮 بازی‌ها", "🤖 هوش مصنوعی"],
  ["👤 پنل شخصی", "👥 مدیریت گروه"],
  ["🏆 رتبه‌بندی", "🚀 چالش روزانه"],
  ["➕ افزودن به گروه", "❌ بستن پنل"],
];

const GAME_KEYBOARD = [
  ["🧠 کوئیز روزانه", "🎲 جرئت یا حقیقت"],
  ["✊ سنگ کاغذ قیچی", "🔤 حدس کلمه"],
  ["📊 ساخت نظرسنجی", "🏆 رتبه‌بندی"],
  ["⬅️ برگشت به پنل"],
];

const WORD_QUIZZES = [
  { question: "کدام واژه با «دریا» هم‌خانواده معنایی نزدیک‌تری دارد؟", options: ["اقیانوس", "کوهستان", "بیابان"], answer: 0 },
  { question: "کدام مورد یک ساز موسیقی است؟", options: ["دفتر", "سه‌تار", "پنجره"], answer: 1 },
  { question: "کدام حیوان پرواز می‌کند؟", options: ["گربه", "اسب", "عقاب"], answer: 2 },
  { question: "کدام واژه متضاد «روشن» است؟", options: ["تاریک", "شفاف", "درخشان"], answer: 0 },
];

const TRUTH_PROMPTS = [
  "آخرین باری که از ته دل خندیدی کی بود؟",
  "کدام عادتت را دوست داری تغییر بدهی؟",
  "یک آهنگ که هیچ‌وقت از گوش دادنش خسته نمی‌شوی چیست؟",
  "خجالت‌آورترین سوتی بامزه‌ات چه بوده؟",
];
const DARE_PROMPTS = [
  "تا سه پیام بعدی فقط با ایموجی جواب بده.",
  "یک تعریف واقعی و محترمانه از نفر سمت راستت بکن.",
  "اسم یک آهنگ را بدون گفتن اسمش با سه ایموجی توضیح بده.",
  "یک جمله را مثل گزارشگر فوتبال هیجان‌زده بخوان و بفرست.",
];

const RPS = ["سنگ", "کاغذ", "قیچی"] as const;
type RpsChoice = typeof RPS[number];

export function isKeyboardCommand(text: string): boolean {
  const value = text.trim().toLowerCase();
  if (value === "پنل" || value === "⌨️ پنل کیبوردی") return true;
  const command = value.split(/\s+/, 1)[0].replace(/@[^@]+$/, "");
  return ["/panel", "/keyboard", "/keypanel"].includes(command);
}

export function parsePollCommand(text: string): { question: string; options: string[] } | null {
  const match = text.trim().match(/^\/poll(?:@[^\s]+)?\s+([\s\S]+)$/i);
  if (!match) return null;
  const parts = match[1].split("|").map(value => value.trim()).filter(Boolean);
  if (parts.length < 3 || parts.length > 11) return null;
  const [question, ...options] = parts;
  if (question.length > 300 || options.some(option => option.length > 100)) return null;
  return { question, options };
}

export function isGroupAdminStatus(status: string): boolean {
  return status === "creator" || status === "administrator";
}

export function rpsWinner(player: RpsChoice, bot: RpsChoice): "win" | "lose" | "draw" {
  if (player === bot) return "draw";
  return (
    (player === "سنگ" && bot === "قیچی") ||
    (player === "کاغذ" && bot === "سنگ") ||
    (player === "قیچی" && bot === "کاغذ")
  ) ? "win" : "lose";
}

function replyKeyboard(rows: string[][] = MAIN_KEYBOARD) {
  return {
    keyboard: rows.map(row => row.map(text => ({ text }))),
    resize_keyboard: true,
    is_persistent: true,
    one_time_keyboard: false,
    input_field_placeholder: "یک گزینه انتخاب کن یا پیام بده…",
  };
}

async function defaultTelegramCall(token: string, method: string, params: Record<string, unknown>): Promise<any> {
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(params),
  });
  const payload = await response.json() as { ok?: boolean; result?: any; description?: string };
  if (!response.ok || payload.ok !== true) throw new Error(`Telegram ${method} failed: ${payload.description ?? response.status}`);
  return payload.result;
}

function mainPanelText(firstName?: string): string {
  return `⚡ پنل کیبوردی AI SHAKI\n\n${firstName ? `${firstName}، ` : ""}از دکمه‌های پایین برای دسترسی سریع استفاده کن.\nبازی‌ها و ابزارها از همین منو اجرا می‌شن.`;
}

async function sendPanel(call: TelegramCall, chatId: number, firstName?: string, privateChat = true): Promise<void> {
  await call("sendMessage", {
    chat_id: chatId,
    text: mainPanelText(firstName),
    ...(privateChat ? { reply_markup: replyKeyboard() } : {}),
  });
}

async function sendGroupOnboarding(call: TelegramCall, chatId: number, title?: string): Promise<void> {
  const groupName = title ? ` «${title}»` : "";
  await call("sendMessage", {
    chat_id: chatId,
    text: `🎉 سلام! AI SHAKI به گروه${groupName} اضافه شد.

🤖 برای شروع، هر وقت خواستید ربات را صدا بزنید یا از دستورهای زیر استفاده کنید:

• بازی‌ها: کوئیز روزانه، سنگ‌کاغذقیچی، حدس کلمه و جرئت یا حقیقت
• پنل گروه همان پنل شیشه‌ای قبلی Mini App است؛ گروه کیبورد جداگانه ندارد
• /leaderboard — جدول امتیازهای همین گروه
• /poll سؤال | گزینه ۱ | گزینه ۲ — ساخت نظرسنجی

👑 مدیران گروه می‌توانند از دکمه «👥 مدیریت گروه» تنظیمات مدیریتی را ببینند.
➕ برای افزودن ربات به گروه دیگر، از دکمه «➕ افزودن به گروه» در پنل استفاده کنید.

💡 نکته: برای عملکرد کامل قابلیت‌های مدیریتی، دسترسی‌های لازم را از تنظیمات مدیران گروه به ربات بدهید. خوش بگذره! 💜`,
    disable_web_page_preview: true,
  });
}

async function sendGameMenu(call: TelegramCall, chatId: number, privateChat = true): Promise<void> {
  await call("sendMessage", {
    chat_id: chatId,
    text: "🎮 بخش بازی‌ها\nیکی از بازی‌های زیر رو انتخاب کن:",
    ...(privateChat ? { reply_markup: replyKeyboard(GAME_KEYBOARD) } : {}),
  });
}

async function showInvite(call: TelegramCall, chatId: number): Promise<void> {
  await call("sendMessage", {
    chat_id: chatId,
    text: "🚀 AI SHAKI رو به گروهت اضافه کن:",
    reply_markup: {
      inline_keyboard: [[{ text: "➕ اضافه کردن AI SHAKI به گروه", url: "https://t.me/AI_SHAKI_BOT?startgroup=true" }]],
    },
  });
}

async function showGroupAdminPanel(call: TelegramCall, chatId: number, userId: number, env: ShakiTelegramEnv, chatType: string): Promise<void> {
  if (chatType !== "group" && chatType !== "supergroup") {
    await call("sendMessage", { chat_id: chatId, text: "👥 مدیریت گروه فقط داخل گروه تلگرام در دسترسه." });
    return;
  }
  const ownerId = Number(env.BOT_OWNER_ID);
  let allowed = Number.isSafeInteger(ownerId) && ownerId > 0 && ownerId === userId;
  if (!allowed) {
    try {
      const member = await call("getChatMember", { chat_id: chatId, user_id: userId });
      allowed = isGroupAdminStatus(String(member?.status ?? ""));
    } catch {
      allowed = false;
    }
  }
  if (!allowed) {
    await call("sendMessage", { chat_id: chatId, text: "⛔ این بخش فقط برای مدیران همین گروهه." });
    return;
  }
  await call("sendMessage", {
    chat_id: chatId,
    text: "👥 مدیریت گروه\n\n• ساخت نظرسنجی: /poll سؤال | گزینه ۱ | گزینه ۲\n• جدول امتیازها: /leaderboard\n• پنل گروه همان پنل شیشه‌ای قبلی Mini App است؛ اینجا کیبوردی نمایش داده نمی‌شود.\n\nابزارهای مدیریتی فقط با دسترسی مدیر گروه اجرا می‌شن.",
  });
}

async function handleCallback(update: TelegramUpdate, call: TelegramCall, env: ShakiTelegramEnv): Promise<boolean> {
  const query = update.callback_query;
  if (!query?.data?.startsWith("shaki:")) return false;
  const chatId = query.message?.chat.id;
  const messageId = query.message?.message_id;
  if (chatId === undefined || messageId === undefined) {
    await call("answerCallbackQuery", { callback_query_id: query.id, text: "این دکمه دیگر فعال نیست." });
    return true;
  }

  const parts = query.data.split(":");
  if (parts[1] === "rps" && parts[3] === "again") {
    const ownerId = Number(parts[2]);
    if (ownerId !== query.from.id) {
      await call("answerCallbackQuery", { callback_query_id: query.id, text: "این بازی برای شخص دیگریه." });
      return true;
    }
    await call("answerCallbackQuery", { callback_query_id: query.id });
    await call("editMessageText", {
      chat_id: chatId, message_id: messageId, text: "✊ دوباره انتخاب کن:",
      reply_markup: { inline_keyboard: [[
        { text: "🪨 سنگ", callback_data: `shaki:rps:${ownerId}:سنگ` },
        { text: "📄 کاغذ", callback_data: `shaki:rps:${ownerId}:کاغذ` },
        { text: "✂️ قیچی", callback_data: `shaki:rps:${ownerId}:قیچی` },
      ]] },
    });
    return true;
  }

  if (parts[1] === "rps") {
    const ownerId = Number(parts[2]);
    if (ownerId !== query.from.id) {
      await call("answerCallbackQuery", { callback_query_id: query.id, text: "این بازی برای شخص دیگریه." });
      return true;
    }
    const player = parts[3] as RpsChoice;
    if (!RPS.includes(player)) {
      await call("answerCallbackQuery", { callback_query_id: query.id, text: "انتخاب نامعتبره." });
      return true;
    }
    const bot = RPS[Math.floor(Math.random() * RPS.length)];
    const result = rpsWinner(player, bot);
    const label = result === "win" ? "🏆 تو بردی!" : result === "lose" ? "🤖 این دست رو من بردم!" : "🤝 مساوی شد!";
    if (result === "win" && chatId < 0 && env.DB) { try { await awardGroupXp(env.DB, chatId, query.from.id, 10, query.id); } catch { /* Optional score storage must not break games. */ } }
    await call("answerCallbackQuery", { callback_query_id: query.id, text: label });
    await call("editMessageText", {
      chat_id: chatId, message_id: messageId,
      text: `✊ سنگ‌کاغذقیچی\n\nانتخاب تو: ${player}\nانتخاب شاکی: ${bot}\n\n${label}`,
      reply_markup: { inline_keyboard: [[
        { text: "🔁 بازی دوباره", callback_data: `shaki:rps:${query.from.id}:again` },
      ]] },
    });
    return true;
  }


  if (parts[1] === "word" && parts[2] === "next") {
    await call("answerCallbackQuery", { callback_query_id: query.id });
    const index = Math.floor(Math.random() * WORD_QUIZZES.length);
    const question = WORD_QUIZZES[index];
    await call("editMessageText", {
      chat_id: chatId, message_id: messageId, text: `🔤 حدس کلمه\n\n${question.question}`,
      reply_markup: { inline_keyboard: [question.options.map((option, i) => ({ text: option, callback_data: `shaki:word:${index}:${i}` }))] },
    });
    return true;
  }

  if (parts[1] === "word") {
    const questionIndex = Number(parts[2]);
    const selected = Number(parts[3]);
    const question = WORD_QUIZZES[questionIndex];
    if (!question || !Number.isInteger(selected) || selected < 0 || selected >= question.options.length) {
      await call("answerCallbackQuery", { callback_query_id: query.id, text: "این سؤال معتبر نیست." });
      return true;
    }
    const correct = selected === question.answer;
    if (correct && chatId < 0 && env.DB) { try { await awardGroupXp(env.DB, chatId, query.from.id, 5, query.id); } catch { /* Optional score storage must not break quizzes. */ } }
    await call("answerCallbackQuery", { callback_query_id: query.id, text: correct ? "آفرین! جواب درسته 🎉" : "این یکی درست نبود؛ دوباره تلاش کن!" });
    await call("editMessageText", {
      chat_id: chatId, message_id: messageId,
      text: `${correct ? "✅ درست گفتی!" : "❌ جواب درست نبود."}\n\n${question.question}\nجواب درست: ${question.options[question.answer]}`,
      reply_markup: { inline_keyboard: [[{ text: "🔁 سؤال بعدی", callback_data: "shaki:word:next:0" }]] },
    });
    return true;
  }


  if (parts[1] === "truth" || parts[1] === "dare") {
    const prompts = parts[1] === "truth" ? TRUTH_PROMPTS : DARE_PROMPTS;
    const prompt = prompts[Math.floor(Math.random() * prompts.length)];
    await call("answerCallbackQuery", { callback_query_id: query.id });
    await call("sendMessage", { chat_id: chatId, text: `${parts[1] === "truth" ? "🧠 حقیقت" : "🔥 جرئت"}\n\n${prompt}` });
    return true;
  }

  return false;
}

export async function handleTelegramKeyboardUpdate(
  update: TelegramUpdate,
  env: ShakiTelegramEnv,
  call?: TelegramCall,
): Promise<boolean> {
  const token = String(env.TOKEN ?? "");
  if (!token) return false;
  const telegram = call ?? ((method, params) => defaultTelegramCall(token, method, params));

  if (await handleCallback(update, telegram, env)) return true;

  const message = update.message;
  if (message?.new_chat_members?.some(member =>
    member.is_bot === true && String(member.username ?? "").toLowerCase() === "ai_shaki_bot"
  )) {
    await sendGroupOnboarding(telegram, message.chat.id, message.chat.title);
    return true;
  }
  const text = String(message?.text ?? "").trim();
  const chatId = message?.chat?.id;
  const userId = message?.from?.id;
  if (!message || !text || typeof chatId !== "number" || !Number.isSafeInteger(chatId)) return false;

  if (/^\/poll(?:@[^\s]+)?(?:\s|$)/i.test(text)) {
    const poll = parsePollCommand(text);
    if (!poll) {
      await telegram("sendMessage", { chat_id: chatId, text: "📊 قالب درست نظرسنجی:\n/poll سؤال؟ | گزینه اول | گزینه دوم\n\nحداقل ۲ و حداکثر ۱۰ گزینه؛ هر گزینه حداکثر ۱۰۰ نویسه." });
      return true;
    }
    await telegram("sendPoll", {
      chat_id: chatId,
      question: poll.question,
      options: poll.options.map(option => ({ text: option })),
      is_anonymous: false,
      allows_multiple_answers: false,
    });
    return true;
  }

  if (isKeyboardCommand(text)) {
    await sendPanel(telegram, chatId, message.from?.first_name);
    return true;
  }

  switch (text) {
    case "🎮 بازی‌ها":
      await sendGameMenu(telegram, chatId, message.chat.type === "private");
      return true;
    case "⬅️ برگشت به پنل":
      await sendPanel(telegram, chatId, message.from?.first_name, message.chat.type === "private");
      return true;
    case "🤖 هوش مصنوعی":
      await telegram("sendMessage", { chat_id: chatId, text: "🤖 همین‌جا پیام متنی‌ات رو بفرست تا با هوش مصنوعی شاکی گفتگو کنی. برای ابزارهای تخصصی هم از دستورهای ربات استفاده کن." });
      return true;
    case "👤 پنل شخصی":
      await telegram("sendMessage", { chat_id: chatId, text: "👤 پنل شخصی\n\nتنظیمات و شخصیت اختصاصی خودت رو از گفتگوی خصوصی با ربات مدیریت کن. تنظیمات شخصی اعضا از هم جداست." });
      return true;
    case "👥 مدیریت گروه":
      if (typeof userId !== "number") return true;
      await showGroupAdminPanel(telegram, chatId, userId, env, message.chat.type);
      return true;
    case "🏆 رتبه‌بندی": {
      if (chatId >= 0 || !env.DB) { await telegram("sendMessage", { chat_id: chatId, text: "🏆 جدول امتیازها فقط در گروهی که امتیاز ثبت کرده نمایش داده می‌شه." }); return true; }
      try {
        const rows = await getGroupLeaderboard(env.DB, chatId, 10);
        const lines = rows.map((row, index) => `${index + 1}. شناسه ${row.userId} — ${row.xp} XP`);
        await telegram("sendMessage", { chat_id: chatId, text: lines.length ? "🏆 رتبه‌بندی گروه\n\n" + lines.join("\n") : "🏆 هنوز امتیازی ثبت نشده؛ با بازی‌کردن اولین نفر جدول شو!" });
      } catch { await telegram("sendMessage", { chat_id: chatId, text: "الان دسترسی به جدول امتیازها ممکن نیست؛ کمی بعد دوباره امتحان کن." }); }
      return true;
    }
    case "🚀 چالش روزانه":
      await telegram("sendMessage", { chat_id: chatId, text: dailyChallengeText(new Date(), "fa") });
      return true;
    case "➕ افزودن به گروه":
      await showInvite(telegram, chatId);
      return true;
    case "❌ بستن پنل":
      await telegram("sendMessage", { chat_id: chatId, text: "پنل بسته شد. هر وقت خواستی /panel رو بفرست.", reply_markup: { remove_keyboard: true } });
      return true;
    case "🧠 کوئیز روزانه":
      await sendGroupQuiz(telegram, chatId, message.message_id, dailyQuiz(new Date(), "fa"));
      return true;
    case "🎲 جرئت یا حقیقت":
      await telegram("sendMessage", {
        chat_id: chatId, text: "🎲 انتخاب کن:",
        reply_markup: { inline_keyboard: [[
          { text: "🧠 حقیقت", callback_data: "shaki:truth" },
          { text: "🔥 جرئت", callback_data: "shaki:dare" },
        ]] },
      });
      return true;
    case "✊ سنگ کاغذ قیچی":
      await telegram("sendMessage", {
        chat_id: chatId, text: "✊ انتخاب کن:",
        reply_markup: { inline_keyboard: [[
          { text: "🪨 سنگ", callback_data: `shaki:rps:${userId}:سنگ` },
          { text: "📄 کاغذ", callback_data: `shaki:rps:${userId}:کاغذ` },
          { text: "✂️ قیچی", callback_data: `shaki:rps:${userId}:قیچی` },
        ]] },
      });
      return true;
    case "🔤 حدس کلمه": {
      const index = Math.floor(Math.random() * WORD_QUIZZES.length);
      const question = WORD_QUIZZES[index];
      await telegram("sendMessage", {
        chat_id: chatId, text: `🔤 حدس کلمه\n\n${question.question}`,
        reply_markup: { inline_keyboard: [question.options.map((option, i) => ({ text: option, callback_data: `shaki:word:${index}:${i}` }))] },
      });
      return true;
    }
    case "📊 ساخت نظرسنجی":
      await telegram("sendMessage", { chat_id: chatId, text: "📊 برای ساخت نظرسنجی این قالب رو بفرست:\n/poll سؤال؟ | گزینه اول | گزینه دوم" });
      return true;
    default:
      return false;
  }
}

/** Intercepts only authenticated Telegram webhook updates; all other traffic remains on the original Worker. */
export async function maybeHandleKeyboardWebhook(request: Request, env: ShakiTelegramEnv, call?: TelegramCall): Promise<Response | null> {
  if (request.method !== "POST" || !env.WEBHOOK_SECRET || !env.TOKEN) return null;
  if (request.headers.get("X-Telegram-Bot-Api-Secret-Token") !== env.WEBHOOK_SECRET) return null;
  let update: TelegramUpdate;
  try { update = await request.clone().json() as TelegramUpdate; }
  catch { return null; }
  const handled = await handleTelegramKeyboardUpdate(update, env, call);
  return handled ? new Response('{"ok":true}', { status: 200, headers: { "content-type": "application/json" } }) : null;
}
