import app from "./index";
import { maybeHandleKeyboardWebhook, type ShakiTelegramEnv } from "./telegramKeyboard";

type ExistingWorker = {
  fetch(request: Request, env: ShakiTelegramEnv, ctx: ExecutionContext): Promise<Response>;
  scheduled?: (controller: ScheduledController, env: ShakiTelegramEnv, ctx: ExecutionContext) => void | Promise<void>;
};

const existing = app as unknown as ExistingWorker;

export default {
  async fetch(request: Request, env: ShakiTelegramEnv, ctx: ExecutionContext): Promise<Response> {
    try {
      const panelResponse = await maybeHandleKeyboardWebhook(request, env);
      if (panelResponse) return panelResponse;
    } catch {
      // A panel failure must never prevent the original AI SHAKI handler from receiving the update.
    }
    return existing.fetch(request, env, ctx);
  },
  scheduled(controller: ScheduledController, env: ShakiTelegramEnv, ctx: ExecutionContext) {
    return existing.scheduled?.(controller, env, ctx);
  },
};
