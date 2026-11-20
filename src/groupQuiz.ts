interface QuizTranslation { question: string; options: readonly [string, string, string] }
interface Quiz { fa: QuizTranslation; en: QuizTranslation; answer: number }
const QUESTIONS: readonly Quiz[] = [
  { fa: { question: "بزرگ‌ترین سیاره منظومه شمسی کدام است؟", options: ["مشتری", "زمین", "مریخ"] }, en: { question: "Which is the largest planet in the solar system?", options: ["Jupiter", "Earth", "Mars"] }, answer: 0 },
  { fa: { question: "آب در فشار استاندارد در چه دمایی می‌جوشد؟", options: ["۵۰ درجه سانتی‌گراد", "۱۰۰ درجه سانتی‌گراد", "۲۰۰ درجه سانتی‌گراد"] }, en: { question: "At standard pressure, at what temperature does water boil?", options: ["50°C", "100°C", "200°C"] }, answer: 1 },
  { fa: { question: "کدام حیوان یک پستاندار دریایی است؟", options: ["دلفین", "کوسه", "اختاپوس"] }, en: { question: "Which animal is a marine mammal?", options: ["Dolphin", "Shark", "Octopus"] }, answer: 0 },
  { fa: { question: "بیشتر خاک مصر در کدام قاره قرار دارد؟", options: ["اروپا", "آفریقا", "آمریکای جنوبی"] }, en: { question: "On which continent is most of Egypt located?", options: ["Europe", "Africa", "South America"] }, answer: 1 },
  { fa: { question: "کدام عنصر نماد شیمیایی O دارد؟", options: ["طلا", "اکسیژن", "نقره"] }, en: { question: "Which element has the chemical symbol O?", options: ["Gold", "Oxygen", "Silver"] }, answer: 1 },
  { fa: { question: "حاصل ۹ ضربدر ۷ چیست؟", options: ["۶۳", "۵۶", "۷۲"] }, en: { question: "What is 9 multiplied by 7?", options: ["63", "56", "72"] }, answer: 0 },
  { fa: { question: "کدام ساز معمولاً کلاویه دارد؟", options: ["پیانو", "ویولن", "فلوت"] }, en: { question: "Which instrument typically has a keyboard?", options: ["Piano", "Violin", "Flute"] }, answer: 0 },
  { fa: { question: "کدام سیاره به سیاره سرخ معروف است؟", options: ["زهره", "مریخ", "زحل"] }, en: { question: "Which planet is known as the Red Planet?", options: ["Venus", "Mars", "Saturn"] }, answer: 1 },
  { fa: { question: "در یک هفته چند روز وجود دارد؟", options: ["۵", "۶", "۷"] }, en: { question: "How many days are in a week?", options: ["5", "6", "7"] }, answer: 2 },
  { fa: { question: "گیاهان برای فتوسنتز معمولاً کدام گاز را جذب می‌کنند؟", options: ["دی‌اکسید کربن", "هلیوم", "نئون"] }, en: { question: "Which gas do plants generally absorb for photosynthesis?", options: ["Carbon dioxide", "Helium", "Neon"] }, answer: 0 },
];

/** A shared question per UTC day; Telegram handles votes and answer reveal. */
export function dailyQuiz(now: Date, lang: string): { question: string; options: string[]; correctOptionId: number } {
  const ms = now.getTime();
  if (!Number.isFinite(ms)) throw new RangeError("Invalid quiz date");
  const day = Math.floor(ms / 86_400_000);
  const quiz = QUESTIONS[((day % QUESTIONS.length) + QUESTIONS.length) % QUESTIONS.length];
  const localized = lang === "fa" ? quiz.fa : quiz.en;
  return { question: localized.question, options: [...localized.options], correctOptionId: quiz.answer };
}

export async function sendGroupQuiz(send: (method: string, params: Record<string, unknown>) => Promise<unknown>, chatId: number, replyTo: number, quiz: ReturnType<typeof dailyQuiz>): Promise<void> {
  await send("sendPoll", { chat_id: chatId, question: quiz.question, options: quiz.options.map(text => ({ text })), type: "quiz", correct_option_id: quiz.correctOptionId, is_anonymous: true, reply_to_message_id: replyTo });
}
