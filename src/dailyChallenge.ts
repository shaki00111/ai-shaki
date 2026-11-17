/**
 * Daily creative prompts. The same prompt is used globally for a UTC day;
 * this feature requires no database, external API, or personal information.
 */
type Challenge = { fa: string; en: string; ar: string };

const CHALLENGES: readonly Challenge[] = [
  { fa: "با پنج کلمه یک داستان کوتاه بساز.", en: "Tell a short story in five words.", ar: "اكتب قصة قصيرة في خمس كلمات." },
  { fa: "یک اختراع خیالی برای بهتر شدن زندگی روزمره پیشنهاد بده.", en: "Invent something that would make everyday life better.", ar: "اقترح اختراعاً خيالياً يجعل الحياة اليومية أفضل." },
  { fa: "با سه ایموجی یک فیلم را توصیف کن تا دیگران حدس بزنند.", en: "Describe a film with three emojis and let others guess it.", ar: "صف فيلماً بثلاثة رموز تعبيرية ودع الآخرين يخمنونه." },
  { fa: "برای یک کافه خیالی یک اسم و شعار خلاقانه انتخاب کن.", en: "Give an imaginary café a creative name and slogan.", ar: "اختر اسماً وشعاراً مبتكراً لمقهى خيالي." },
  { fa: "یک جمله مهربانانه برای کسی بنویس، بدون اینکه نامش را بگویی.", en: "Write a kind sentence for someone without naming them.", ar: "اكتب جملة لطيفة لشخص من دون ذكر اسمه." },
  { fa: "اگر می‌توانستی یک مهارت را فوری یاد بگیری، کدام بود و چرا؟", en: "If you could instantly learn one skill, what would it be and why?", ar: "لو استطعت تعلم مهارة فوراً، فما هي ولماذا؟" },
  { fa: "یک عنوان بامزه برای کتاب زندگی امروزت بنویس.", en: "Give a funny title to a book about your day.", ar: "اكتب عنواناً طريفاً لكتاب عن يومك." },
  { fa: "یک شهر خیالی را در یک جمله توصیف کن.", en: "Describe an imaginary city in one sentence.", ar: "صف مدينة خيالية في جملة واحدة." },
  { fa: "برای یک گربه فضانورد اسم و مأموریت انتخاب کن.", en: "Name an astronaut cat and describe its mission.", ar: "اختر اسماً لقطة رائدة فضاء وصف مهمتها." },
  { fa: "یک ایده ساده برای کمک به محیط زیست پیشنهاد بده.", en: "Suggest one simple way to help the environment.", ar: "اقترح فكرة بسيطة للمساعدة في حماية البيئة." },
  { fa: "یک داستان دو جمله‌ای بساز که با «ناگهان» شروع شود.", en: "Write a two-sentence story that begins with ‘Suddenly’.", ar: "اكتب قصة من جملتين تبدأ بكلمة «فجأة»." },
  { fa: "یک غذای خیالی ابداع کن و اسمش را بگو.", en: "Invent a fictional dish and give it a name.", ar: "ابتكر طبقاً خيالياً واختر له اسماً." },
  { fa: "برای امروزت یک ابرقدرت بامزه انتخاب کن.", en: "Choose a funny superpower for your day.", ar: "اختر قوة خارقة طريفة ليومك." },
  { fa: "یک سؤال جالب بپرس که دوست داری همه جواب بدهند.", en: "Ask an interesting question you would like everyone to answer.", ar: "اطرح سؤالاً ممتعاً تود أن يجيب عنه الجميع." },
];

const DAY_MS = 86_400_000;

/** Render a stable, plain-text challenge. Days change at midnight UTC. */
export function dailyChallengeText(now: Date, language: string): string {
  const time = now.getTime();
  if (!Number.isFinite(time)) throw new RangeError("Invalid challenge date");
  const day = Math.floor(time / DAY_MS);
  const prompt = CHALLENGES[((day % CHALLENGES.length) + CHALLENGES.length) % CHALLENGES.length];
  const date = now.toISOString().slice(0, 10);
  if (language === "fa") return `🚀 چالش روزانه شاکی · ${date} UTC\n\n${prompt.fa}\n\nجوابت رو بنویس یا این چالش رو با دوستات به اشتراک بذار!`;
  if (language === "ar") return `🚀 تحدي شاکی اليومي · ${date} UTC\n\n${prompt.ar}\n\nاكتب إجابتك أو شارك التحدي مع أصدقائك!`;
  return `🚀 SHAKI Daily Challenge · ${date} UTC\n\n${prompt.en}\n\nWrite your answer or share the challenge with friends!`;
}
