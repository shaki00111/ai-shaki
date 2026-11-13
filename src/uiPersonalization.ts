export const OWNER_UI_BUTTONS = [
  { id: "personas", callback: "home:personas", label: "🎭 انتخاب شخصیت (فقط برای من)" },
  { id: "prompt", callback: "home:prompt", label: "✏️ پرامپت شخصی من" },
  { id: "clear_memory", callback: "home:new_confirm", label: "🆕 پاک کردن حافظه من" },
  { id: "help", callback: "home:help", label: "❓ راهنما" },
  { id: "group_settings", callback: "group_settings", label: "👥 تنظیمات گروه (مدیریت)" },
  { id: "close", callback: "home:close", label: "✖️ بستن" },
] as const;

export type OwnerUiButtonId = typeof OWNER_UI_BUTTONS[number]["id"];
export interface OwnerUiCustomization {
  welcomeTextFa: string;
  welcomeTextEn: string;
  labels: Partial<Record<OwnerUiButtonId, string>>;
  hidden: OwnerUiButtonId[];
  order: OwnerUiButtonId[];
}

export const DEFAULT_OWNER_UI_CUSTOMIZATION: OwnerUiCustomization = {
  welcomeTextFa: "",
  welcomeTextEn: "",
  labels: {},
  hidden: [],
  order: OWNER_UI_BUTTONS.map(button => button.id),
};

const allowed = new Set<string>(OWNER_UI_BUTTONS.map(button => button.id));

export function normalizeOwnerUiCustomization(value: unknown): OwnerUiCustomization {
  const input = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const labels: OwnerUiCustomization["labels"] = {};
  if (input.labels && typeof input.labels === "object" && !Array.isArray(input.labels)) {
    for (const [key, raw] of Object.entries(input.labels as Record<string, unknown>)) {
      if (!allowed.has(key) || typeof raw !== "string") continue;
      const label = raw.trim().replace(/[\u0000-\u001f\u007f]/g, "").slice(0, 48);
      if (label) labels[key as OwnerUiButtonId] = label;
    }
  }
  const hidden = Array.isArray(input.hidden)
    ? [...new Set(input.hidden.filter((id): id is OwnerUiButtonId => typeof id === "string" && allowed.has(id)))]
    : [];
  const requestedOrder = Array.isArray(input.order)
    ? input.order.filter((id): id is OwnerUiButtonId => typeof id === "string" && allowed.has(id))
    : [];
  const order = [...new Set([...requestedOrder, ...OWNER_UI_BUTTONS.map(button => button.id)])];
  return {
    welcomeTextFa: typeof input.welcomeTextFa === "string" ? input.welcomeTextFa.slice(0, 1200) : "",
    welcomeTextEn: typeof input.welcomeTextEn === "string" ? input.welcomeTextEn.slice(0, 1200) : "",
    labels,
    hidden,
    order,
  };
}

export function ownerUiButtonLabel(id: OwnerUiButtonId, custom: OwnerUiCustomization): string {
  return custom.labels[id] || OWNER_UI_BUTTONS.find(button => button.id === id)?.label || id;
}

export function ownerUiButtons(custom: OwnerUiCustomization, isGroupAdmin: boolean) {
  return custom.order
    .filter(id => !custom.hidden.includes(id))
    .filter(id => id !== "group_settings" || isGroupAdmin)
    .map(id => ({ id, callback: OWNER_UI_BUTTONS.find(button => button.id === id)!.callback, text: ownerUiButtonLabel(id, custom) }));
}

export function ownerUiWelcome(custom: OwnerUiCustomization, language: string, fallback: string, name: string): string {
  const configured = language === "fa" ? custom.welcomeTextFa : custom.welcomeTextEn;
  if (!configured.trim()) return fallback;
  const safeName = name.replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]!));
  const escaped = configured.replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]!));
  return escaped.replace(/\{name\}/g, safeName);
}
