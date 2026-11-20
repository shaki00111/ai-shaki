import app from "./index";
import type { ShakiTelegramEnv } from "./telegramKeyboard";

type ExistingWorker = {
  fetch(request: Request, env: ShakiTelegramEnv, ctx: ExecutionContext): Promise<Response>;
  scheduled?: (controller: ScheduledController, env: ShakiTelegramEnv, ctx: ExecutionContext) => void | Promise<void>;
};

const existing = app as unknown as ExistingWorker;

export default {
  // Keep the original Telegram handler as the single source of truth.
  // It owns the glass inline-button panels in both private chats and groups.
  // Do not intercept /panel or replace the original menus with reply keyboards.
  async fetch(request: Request, env: ShakiTelegramEnv, ctx: ExecutionContext): Promise<Response> {
    return existing.fetch(request, env, ctx);
  },
  scheduled(controller: ScheduledController, env: ShakiTelegramEnv, ctx: ExecutionContext) {
    return existing.scheduled?.(controller, env, ctx);
  },
};
