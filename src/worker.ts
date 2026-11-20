import app from "./index";
import type { ShakiTelegramEnv } from "./telegramKeyboard";
import {
  classifyLegacyKeyboardUpdate,
  removeLegacyReplyKeyboard,
} from "./legacyKeyboardGuard";

type ExistingWorker = {
  fetch(request: Request, env: ShakiTelegramEnv, ctx: ExecutionContext): Promise<Response>;
  scheduled?: (controller: ScheduledController, env: ShakiTelegramEnv, ctx: ExecutionContext) => void | Promise<void>;
};

const existing = app as unknown as ExistingWorker;

async function telegramCall(token: string, method: string, params: Record<string, unknown>): Promise<any> {
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(params),
  });
  const payload = await response.json() as { ok?: boolean; result?: any; description?: string };
  if (!response.ok || payload.ok !== true) {
    throw new Error(`Telegram ${method} failed: ${payload.description ?? response.status}`);
  }
  return payload.result;
}

function ok(): Response {
  return new Response('{"ok":true}', { status: 200, headers: { "content-type": "application/json" } });
}

export default {
  async fetch(request: Request, env: ShakiTelegramEnv, ctx: ExecutionContext): Promise<Response> {
    // Only trust Telegram webhook updates authenticated with the configured secret.
    if (
      request.method === "POST" &&
      env.TOKEN &&
      env.WEBHOOK_SECRET &&
      request.headers.get("X-Telegram-Bot-Api-Secret-Token") === env.WEBHOOK_SECRET
    ) {
      try {
        const update = await request.clone().json() as Parameters<typeof classifyLegacyKeyboardUpdate>[0];
        const decision = classifyLegacyKeyboardUpdate(update);
        if (decision !== "none") {
          const chatId = update.message!.chat!.id!;
          await removeLegacyReplyKeyboard(chatId, (method, params) => telegramCall(env.TOKEN!, method, params)).catch(() => {});

          // Taps on old ReplyKeyboard buttons must never be sent to SHAKI as prompts.
          if (decision === "close") return ok();
          if (decision === "reopen") {
            update.message!.text = "/start";
            const headers = new Headers(request.headers);
            headers.delete("content-length");
            request = new Request(request.url, {
              method: "POST",
              headers,
              body: JSON.stringify(update),
            });
          }
        }
      } catch {
        // Malformed updates or a temporary Telegram API failure must not break the original webhook.
      }
    }

    return existing.fetch(request, env, ctx);
  },
  scheduled(controller: ScheduledController, env: ShakiTelegramEnv, ctx: ExecutionContext) {
    return existing.scheduled?.(controller, env, ctx);
  },
};
