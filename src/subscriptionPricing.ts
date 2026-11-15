export interface SubscriptionPlan {
  id: string;
  days: number;
  priceToman: number;
  labelFa: string;
  labelEn: string;
}

export const SUBSCRIPTION_PLANS: readonly SubscriptionPlan[] = Object.freeze([
  { id: "week", days: 7, priceToman: 50_000, labelFa: "یک هفته", labelEn: "1 week" },
  { id: "month_1", days: 30, priceToman: 100_000, labelFa: "یک ماه", labelEn: "1 month" },
  { id: "month_2", days: 60, priceToman: 200_000, labelFa: "دو ماه", labelEn: "2 months" },
  { id: "month_3", days: 90, priceToman: 300_000, labelFa: "سه ماه", labelEn: "3 months" },
  { id: "month_4", days: 120, priceToman: 400_000, labelFa: "چهار ماه", labelEn: "4 months" },
  { id: "month_5", days: 150, priceToman: 500_000, labelFa: "پنج ماه", labelEn: "5 months" },
]);

function formatToman(amount: number, locale: string): string {
  return new Intl.NumberFormat(locale === "fa" ? "fa-IR" : "en-US").format(amount);
}

/** Display-only price list. It deliberately does not grant VIP or imply payment. */
export function formatSubscriptionPricing(language: string = "fa"): string {
  if (language === "fa") {
    return [
      "💎 **تعرفه اشتراک VIP شاکی**",
      ...SUBSCRIPTION_PLANS.map(plan => `• ${plan.labelFa}: **${formatToman(plan.priceToman, "fa")} تومان**`),
      "",
      "برای فعال‌سازی اشتراک و هماهنگی پرداخت با پشتیبانی تماس بگیرید.",
    ].join("\n");
  }
  return [
    "💎 **SHAKI VIP subscription prices**",
    ...SUBSCRIPTION_PLANS.map(plan => `• ${plan.labelEn}: **${formatToman(plan.priceToman, "en")} Toman**`),
    "",
    "Contact support to arrange activation and payment.",
  ].join("\n");
}
