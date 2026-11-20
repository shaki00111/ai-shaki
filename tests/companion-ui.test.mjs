import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const pages = [
  ["public", "src/dashboard.html"],
  ["owner", "src/adminDashboard.html"],
];

for (const [name, path] of pages) {
  test(name + " Mini App companion follows interaction without intercepting controls", () => {
    const html = readFileSync(path, "utf8");
    assert.match(html, /id="shaki-companion-motion-polish"/);
    assert.match(html, /pointermove/);
    assert.match(html, /focusin/);
    assert.match(html, /shaki:companion-sad/);
    assert.match(html, /shaki:companion-thinking/);
    assert.match(html, /prefers-reduced-motion:reduce/);
    assert.match(html, /pointer-events:none/);
    assert.match(html, /aria-hidden","true"/);
    assert.match(html, /shaki-blink/);
    assert.match(html, /shaki-curious/);
    assert.match(html, /shaki-think/);
  });
}
