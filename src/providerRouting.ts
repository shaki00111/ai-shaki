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


/**
 * A key can pass a lightweight ping while its Google Cloud project is not
 * eligible for Gemini free-tier generation. Treat this as a project/key
 * routing failure (not a globally invalid credential) and move to another key.
 */
export function isGeminiProjectUnavailableError(message: string): boolean {
  const normalized = message.toLowerCase();
  return normalized.includes("free tier is not available for this project")
    || normalized.includes("project is not available")
    || normalized.includes("project-unavailable")
    || normalized.includes("billing is not enabled for this project")
    || normalized.includes("gemini api is not available for this project");
}
