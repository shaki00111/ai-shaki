import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const html = readFileSync(new URL("../src/dashboard.html", import.meta.url), "utf8");
test("dashboard exposes a prominent Telegram add-to-group action", () => {
 assert.match(html, /class="group-growth"/);
 assert.match(html, /href="https:\/\/t\.me\/AI_SHAKI_BOT\?startgroup=true"/);
 assert.match(html, /اضافه کردن به گروه/);
});
test("dashboard includes Telegram share and group shortcuts", () => {
 assert.match(html, /https:\/\/t\.me\/share\/url\?/);
 for (const command of ["/quiz","/poll","/challenge","/leaderboard"]) assert.ok(html.includes(command), command);
});
test("group invitation card remains responsive and accessible", () => {
 assert.match(html, /aria-label="دعوت و سرگرمی گروهی"/);
 assert.match(html, /@media\(max-width:380px\)/);
 assert.match(html, /rel="noopener"/);
});
