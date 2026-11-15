/** Shared eligibility gate for the plain-text WusRouter fallback. */
export interface WusRouterTextFallbackInput {
  enabled: boolean;
  configured: boolean;
  plainTextTurn: boolean;
  plainTextHistory: boolean;
  intentCategory: string;
  remainingMs: number;
  modelBudgetAvailable?: boolean;
}

const WUSROUTER_TEXT_INTENTS = new Set(["activation", "general_knowledge", "conversation"]);

export function canUseWusRouterTextFallback(input: WusRouterTextFallbackInput): boolean {
  return input.enabled === true
    && input.configured === true
    && input.plainTextTurn === true
    && input.plainTextHistory === true
    && WUSROUTER_TEXT_INTENTS.has(input.intentCategory)
    && input.modelBudgetAvailable !== false
    && Number.isFinite(input.remainingMs)
    && input.remainingMs >= 5_000;
}

/** Return only model IDs advertised by this exact WusRouter credential.
 * The configured default is tried first, followed by compatible Qwen/chat
 * models. This avoids assuming that a visible API key grants every :free route.
 */
export function getWusRouterModelCandidates(payload: unknown, preferred: string): string[] {
  if (!payload || typeof payload !== "object") return [];
  const data = payload as { data?: unknown; models?: unknown };
  const rows = Array.isArray(data.data) ? data.data : Array.isArray(data.models) ? data.models : [];
  const ids = [...new Set(rows.map((row: any) =>
    typeof row === "string" ? row : typeof row?.id === "string" ? row.id : typeof row?.name === "string" ? row.name : ""
  ).map((id: string) => id.trim()).filter(Boolean))];
  const coder = /coder/i.test(preferred);
  const score = (id: string): number => {
    let value = id === preferred ? 1000 : 0;
    const lower = id.toLowerCase();
    if (coder) {
      if (/qwen.*coder|coder.*qwen/.test(lower)) value += 200;
      else if (/coder/.test(lower)) value += 150;
      else if (/qwen/.test(lower)) value += 50;
    } else {
      if (/qwen3\.8.*flash|qwen.*flash/.test(lower)) value += 200;
      else if (/qwen/.test(lower)) value += 150;
      else if (/llama|deepseek/.test(lower)) value += 50;
    }
    return value;
  };
  return ids.sort((a, b) => score(b) - score(a)).slice(0, 5);
}

