export const OWNER_MENU_ITEMS = [
  { id: "personas", callback: "home:personas", fa: "🎭 تغییر شخصیت" },
  { id: "new_chat", callback: "home:new_confirm", fa: "🆕 گفتگوی جدید" },
  { id: "prompt", callback: "home:prompt", fa: "✏️ پرامپت سفارشی" },
  { id: "language", callback: "home:language", fa: "🌐 تغییر زبان" },
  { id: "help", callback: "home:help", fa: "❓ راهنما" },
  { id: "vip", callback: "home:vip", fa: "💎 ارتقا به VIP" },
  { id: "owner_online", callback: "owner_presence_online", fa: "🟢 شاکی آنلاینم" },
  { id: "owner_offline", callback: "owner_presence_offline", fa: "🌙 شاکی آفلاینم" },
  { id: "admin_panel", callback: "open_admin", fa: "👑 پنل مدیریت ارشد" },
  { id: "user_dashboard", callback: "user_dashboard", fa: "🚀 داشبورد من" },
  { id: "group_settings", callback: "group_settings", fa: "👥 تنظیمات گروه" },
  { id: "close", callback: "home:close", fa: "✖️ بستن منو" },
] as const;

export type OwnerMenuItemId = typeof OWNER_MENU_ITEMS[number]["id"];
export interface OwnerPersonalization {
  labels: Partial<Record<OwnerMenuItemId, string>>;
  hidden: OwnerMenuItemId[];
  order: OwnerMenuItemId[];
}
export const DEFAULT_OWNER_PERSONALIZATION: OwnerPersonalization = {
  labels: {}, hidden: [], order: OWNER_MENU_ITEMS.map(item => item.id),
};
const ITEM_IDS = new Set<string>(OWNER_MENU_ITEMS.map(item => item.id));
const REQUIRED_VISIBLE = new Set<string>(["personas", "close"]);

export function normalizeOwnerPersonalization(input: unknown): OwnerPersonalization {
  const raw = input && typeof input === "object" ? input as Record<string, unknown> : {};
  const rawLabels = raw.labels && typeof raw.labels === "object" ? raw.labels as Record<string, unknown> : {};
  const labels: OwnerPersonalization["labels"] = {};
  for (const [key, value] of Object.entries(rawLabels)) {
    if (!ITEM_IDS.has(key) || typeof value !== "string") continue;
    const clean = value.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 40);
    if (clean) labels[key as OwnerMenuItemId] = clean;
  }
  const hidden = Array.isArray(raw.hidden)
    ? [...new Set(raw.hidden.filter((id): id is OwnerMenuItemId =>
        typeof id === "string" && ITEM_IDS.has(id) && !REQUIRED_VISIBLE.has(id)))]
    : [];
  const requestedOrder = Array.isArray(raw.order)
    ? raw.order.filter((id): id is OwnerMenuItemId => typeof id === "string" && ITEM_IDS.has(id))
    : [];
  const order = [...new Set(requestedOrder)];
  for (const item of OWNER_MENU_ITEMS) if (!order.includes(item.id)) order.push(item.id);
  return { labels, hidden, order };
}

/** Apply presentation only; callback_data, URLs and web-app targets stay untouched. */
export function applyOwnerMenuPersonalization<T extends {
  text: string; callback_data?: string; url?: string; web_app?: { url: string };
}>(keyboard: { inline_keyboard: T[][] }, input: unknown): { inline_keyboard: T[][] } {
  const settings = normalizeOwnerPersonalization(input);
  const idFor = (button: T): OwnerMenuItemId | null => {
    if (button.web_app?.url) {
      if (button.web_app.url.includes("/admin")) return "admin_panel";
      if (button.web_app.url.includes("/my")) return "user_dashboard";
    }
    if (button.url?.includes("start=mydash")) return "user_dashboard";
    return OWNER_MENU_ITEMS.find(item => item.callback === button.callback_data)?.id ?? null;
  };
  const buttons = keyboard.inline_keyboard.flat().map(button => {
    const id = idFor(button);
    if (!id) return { button, id: null as OwnerMenuItemId | null };
    const item = OWNER_MENU_ITEMS.find(entry => entry.id === id)!;
    return { id, button: { ...button, text: settings.labels[id] ?? button.text } as T };
  }).filter(entry => !entry.id || !settings.hidden.includes(entry.id));
  buttons.sort((a, b) => {
    if (a.id === "close") return 1;
    if (b.id === "close") return -1;
    const ai = a.id ? settings.order.indexOf(a.id) : Number.MAX_SAFE_INTEGER;
    const bi = b.id ? settings.order.indexOf(b.id) : Number.MAX_SAFE_INTEGER;
    return ai - bi;
  });
  const rows: T[][] = [];
  for (let i = 0; i < buttons.length; i += 2) rows.push(buttons.slice(i, i + 2).map(entry => entry.button));
  return { inline_keyboard: rows };
}
export function ownerPersonalizationPreview(input: unknown): string[] {
  const settings = normalizeOwnerPersonalization(input);
  return settings.order.filter(id => !settings.hidden.includes(id))
    .map(id => settings.labels[id] ?? OWNER_MENU_ITEMS.find(item => item.id === id)!.fa);
}
