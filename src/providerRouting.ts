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
