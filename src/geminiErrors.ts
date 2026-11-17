import { redactSecrets } from "./core";

/** Preserve upstream status when a non-success JSON body omits its code. */
export function geminiErrorWithHttpStatus<T extends { error?: { message: string; code?: number } }>(payload: T, status: number): T {
  if (!payload.error || payload.error.code) return payload;
  return { ...payload, error: { ...payload.error, code: status } };
}

/** Normalize the upstream error without exposing the credential in diagnostics. */
export function geminiStreamError(error: { message: string; code?: number }, apiKey: string): Error {
  const message = redactSecrets(String(error.message ?? "Unknown error"), apiKey, encodeURIComponent(apiKey));
  const lower = message.toLowerCase();
  if (error.code === 429 || /quota|rate.?limit|resource_exhausted|\b429\b/i.test(lower)) {
    return new Error(`GEMINI_QUOTA|${error.code ?? 429}|${message}`);
  }
  if (/expired|leaked/.test(lower)) return new Error("auth: key expired/leaked");
  if (/safety|blocked/.test(lower)) return new Error("blocked by safety filter");
  if (error.code === 401 || /\b401\b|unauthorized/.test(lower)) return new Error("auth: unauthorized");
  // Keep a numeric status even when the provider message has no useful code.
  return new Error(`Gemini${error.code ? ` HTTP ${error.code}` : ""}: ${message}`);
}
