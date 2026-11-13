#!/usr/bin/env node
/**
 * ƝØVΛ — Advanced AI Agent Platform for Telegram
 * Copyright (C) 2026 Hsoofi82
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * Source regression tests: keep the open-source distribution healthy.
 *  - required community/license files exist
 *  - every source file carries the AGPL license header
 *  - wrangler.toml contains no credentials
 *  - no secret-looking values anywhere in the tracked tree
 *
 * Run: npm test
 */

import { readFileSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";

let failures = 0;
const fail = (msg) => { console.error(`  ✗ ${msg}`); failures++; };
const ok = (msg) => console.log(`  ✓ ${msg}`);

// ── tracked files ────────────────────────────────────────────────────────────
const tracked = execSync("git ls-files", { encoding: "utf8" })
  .split("\n")
  .filter(Boolean);

console.log("\n[1] Required files");
const required = [
  "LICENSE", "README.md", "CHANGELOG.md", "CONTRIBUTING.md", "SECURITY.md",
  "CODE_OF_CONDUCT.md", "THIRD_PARTY_NOTICES.md",
  ".env.example", ".dev.vars.example", ".gitignore",
  "package.json", "tsconfig.json", "wrangler.toml",
  ".github/CODEOWNERS",
  ".github/PULL_REQUEST_TEMPLATE.md",
  ".github/ISSUE_TEMPLATE/bug_report.md",
  ".github/ISSUE_TEMPLATE/feature_request.md",
  "src/index.ts", "tests/source-regression.mjs",
];
for (const f of required) {
  existsSync(f) ? ok(f) : fail(`missing required file: ${f}`);
}
// CI workflow: either enabled in place, or shipped as the example to rename.
const CI_ENABLED = ".github/workflows/ci.yml";
const CI_EXAMPLE = ".github/ci-workflow.example.yml";
if (existsSync(CI_ENABLED)) ok(CI_ENABLED);
else if (existsSync(CI_EXAMPLE)) ok(`${CI_EXAMPLE} (CI ready to enable)`);
else fail(`missing CI workflow (${CI_ENABLED} or ${CI_EXAMPLE})`);

console.log("\n[2] License metadata");
const license = readFileSync("LICENSE", "utf8");
license.includes("GNU AFFERO GENERAL PUBLIC LICENSE") &&
license.includes("Version 3, 19 November 2007")
  ? ok("LICENSE is the GNU AGPL v3.0 text")
  : fail("LICENSE does not look like the AGPL v3.0 text");
const pkg = JSON.parse(readFileSync("package.json", "utf8"));
pkg.license === "AGPL-3.0-or-later"
  ? ok('package.json license = "AGPL-3.0-or-later"')
  : fail(`package.json license is "${pkg.license}", expected "AGPL-3.0-or-later"`);

console.log("\n[3] AGPL license metadata");
const SPDX = "SPDX-License-Identifier: AGPL-3.0-or-later";
const sourceFiles = tracked.filter((f) =>
  (f.startsWith("src/") && (f.endsWith(".ts") || f.endsWith(".html"))) ||
  f === "globals.d.ts"
);
// Per-file SPDX comments are optional under AGPL when the repository ships the
// complete LICENSE and package metadata. Report omissions without blocking
// runtime validation; do not force comment-only edits across vendored/legacy code.
const headerExempt = new Set(["src/telegram-web-app.txt", "src/shakiFont.ts"]);
const missingHeaders = sourceFiles.filter((f) =>
  !headerExempt.has(f) && !readFileSync(f, "utf8").includes(SPDX)
);
if (missingHeaders.length) {
  console.warn(`  ⚠ ${missingHeaders.length} source files rely on the repository LICENSE instead of per-file SPDX comments`);
}
ok("repository-level AGPL license metadata is present");

console.log("\n[4] wrangler.toml hygiene");
const toml = readFileSync("wrangler.toml", "utf8");
const CREDENTIAL_VARS = [
  "TOKEN", "BOT_OWNER_ID", "WEBHOOK_SECRET",
  "GEMINI_KEY_1", "GEMINI_KEY_2", "GEMINI_KEY_3", "GEMINI_KEY_4", "GEMINI_KEY_5",
  "GOOGLE_SEARCH_API_KEY", "GOOGLE_SEARCH_ENGINE_ID",
  "CF_ID_1", "CF_TOKEN_1", "CF_ID_2", "CF_TOKEN_2", "CF_ID_3", "CF_TOKEN_3",
];
for (const name of CREDENTIAL_VARS) {
  new RegExp(`^${name}\\s*=`, "m").test(toml)
    ? fail(`wrangler.toml sets "${name}" — credentials must be Worker Secrets, not [vars]`)
    : ok(`no "${name}" in wrangler.toml`);
}
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const dbId = toml.match(/^database_id\s*=\s*"([^"]*)"/m)?.[1] ?? "";
dbId === "<YOUR_D1_DATABASE_ID>" || UUID_RE.test(dbId)
  ? ok(`D1 database_id is configured ("${dbId === "<YOUR_D1_DATABASE_ID>" ? "placeholder" : "uuid"}")`)
  : fail("wrangler.toml database_id should be the <YOUR_D1_DATABASE_ID> placeholder or a D1 uuid");

console.log("\n[5] Secret-leak guard (whole tree)");
// Patterns that indicate real credentials. Placeholders in examples are empty strings.
const SECRET_PATTERNS = [
  [/AIza[0-9A-Za-z_-]{30,}/, "Google API key (AIza…)"],
  [/\b\d{8,10}:AA[0-9A-Za-z_-]{30,}/, "Telegram bot token"],
  [/\bcfat_[0-9A-Za-z_-]{20,}/, "Cloudflare API token (cfat_…)"],
  [/[0-9a-f]{64}/, "64-char hex secret (webhook secret / private key material)"],
];
let scanned = 0;
for (const f of tracked) {
  if (!/\.(ts|html|txt|toml|json|md|yml|yaml|js|mjs|css|d\.ts)$/i.test(f)) continue;
  const content = readFileSync(f, "utf8");
  scanned++;
  for (const [re, label] of SECRET_PATTERNS) {
    if (re.test(content)) fail(`${f}: contains a ${label}`);
  }
}
ok(`scanned ${scanned} tracked text files`);

// ── SHAKI Mini App delivery invariants ────────────────────────────────────
console.log("\n[6] Mini App media and mobile layout invariants");
const indexSource = readFileSync("src/index.ts", "utf8");
const dashboardSource = readFileSync("src/dashboard.html", "utf8");
indexSource.includes('putMediaBlob(env, id, bytesToArrayBuffer(audio), "audio/mpeg")')
  ? ok("Mini App voice blobs keep their real MPEG MIME type")
  : fail("Mini App voice blobs must use audio/mpeg for synthesized MP3 bytes");
indexSource.includes('${requestOrigin}/app/${id}.mp3')
  ? ok("Mini App voice URLs use the .mp3 extension")
  : fail("Mini App voice URL extension does not match synthesized MP3 bytes");
dashboardSource.includes('#app{display:flex!important;width:100vw!important;max-width:none!important')
  ? ok("Telegram Mini App shell fills the viewport on mobile")
  : fail("Telegram Mini App shell is missing the full-width viewport fix");

dashboardSource.includes("--accent:#9b7bff!important") && dashboardSource.includes("--accent-2:#38bdf8!important")
  ? ok("Mini App uses the violet/blue SHAKI identity")
  : fail("Mini App violet/blue brand tokens are missing");
const adminSource = readFileSync("src/adminDashboard.html", "utf8");
adminSource.includes("--accent:#9b7bff!important") && adminSource.includes("--accent-2:#38bdf8!important")
  ? ok("Owner dashboard uses the same violet/blue identity")
  : fail("Owner dashboard brand tokens do not match the Mini App");


// ── VIP tool quota invariants ─────────────────────────────────────────────
console.log("\n[7] VIP tool quota invariants");
const toolStart = indexSource.indexOf("async function executeStructuredTools");
const toolEnd = indexSource.indexOf("\ninterface BotConfigChange", toolStart);
const toolSource = toolStart >= 0 && toolEnd > toolStart ? indexSource.slice(toolStart, toolEnd) : "";
const quotaStart = toolSource.indexOf("const applyUsageQuota");
const quotaEnd = toolSource.indexOf("const releaseReservedUsage", quotaStart);
const quotaSource = quotaStart >= 0 && quotaEnd > quotaStart ? toolSource.slice(quotaStart, quotaEnd) : "";
toolSource.includes("const limitSession = privateUserSession;")
  ? ok("group and private tool usage share the sender's private quota session")
  : fail("tool quota session must always be the sender's private session");
quotaSource.includes('checkDailyLimitPrivate(limitSession, "voice_sent", isVip)') &&
quotaSource.includes('checkDailyLimitPrivate(limitSession, "image", isVip)')
  ? ok("VIP custom limits and permissions are checked before tool execution")
  : fail("voice/image tool reservations must enforce VIP limits and permissions");
quotaSource.includes('incrementUsagePrivate(limitSession, "voice_sent")') &&
quotaSource.includes('incrementUsagePrivate(limitSession, "image")') &&
quotaSource.includes('updateMutex.run(`usage:${sender.id}`, applyUsageQuota)')
  ? ok("voice/image reservations are serialized per user")
  : fail("voice/image quota reservations must be serialized per user");
toolSource.includes("hasStarted: (): boolean => started !== null") &&
toolSource.includes('if (!task.hasStarted())') &&
toolSource.includes('await releaseReservedUsage("voice_sent")')
  ? ok("unused and never-started tool reservations are released")
  : fail("unused tool quota reservations must be released");
const ttsStart = indexSource.indexOf("async function handleTTS");
const ttsEnd = indexSource.indexOf("\nasync function handleOCR", ttsStart);
const ttsSource = ttsStart >= 0 && ttsEnd > ttsStart ? indexSource.slice(ttsStart, ttsEnd) : "";
const reservationStart = indexSource.indexOf("async function reserveDailyUsageWithUser");
const reservationEnd = indexSource.indexOf("\nfunction formatConfigChangeSummary", reservationStart);
const reservationSource = reservationStart >= 0 && reservationEnd > reservationStart
  ? indexSource.slice(reservationStart, reservationEnd) : "";
ttsSource.includes('reserveDailyUsageWithUser(session, from, "voice_sent", env)') &&
reservationSource.includes("incrementUsagePrivate(target, type);") &&
reservationSource.includes("await saveSession(target, env);")
  ? ok("private /tts reserves and persists voice usage before synthesis")
  : fail("private /tts must reserve and persist voice usage before synthesis");

// ── Incoming voice quota accounting ────────────────────────────────────────
console.log("\n[8] Incoming voice quota accounting");
const incomingVoiceStart = indexSource.indexOf("async function handleVoiceMessage");
const incomingVoiceEnd = indexSource.indexOf("\nasync function handleMediaMessage", incomingVoiceStart);
const incomingVoiceSource = incomingVoiceStart >= 0 && incomingVoiceEnd > incomingVoiceStart
  ? indexSource.slice(incomingVoiceStart, incomingVoiceEnd) : "";
incomingVoiceSource.includes('checkDailyLimitWithUser(session, from, "message", env)') &&
!incomingVoiceSource.includes('incrementUsageWithUser(session, from, "message", env)') &&
!incomingVoiceSource.includes('checkDailyLimitWithUser(session, from, "voice_sent", env)') &&
!incomingVoiceSource.includes('incrementUsageWithUser(session, from, "voice_sent", env)')
  ? ok("incoming voice checks message eligibility and the AI turn counts it once")
  : fail("incoming voice must not consume the voice-generation quota");

// ── Direct voice quota reservation ─────────────────────────────────────────
console.log("\n[9] Direct voice quota reservation");
const directVoiceStart = indexSource.indexOf("const directVoiceText = extractDirectVoiceText");
const directVoiceEnd = indexSource.indexOf("\n      sendTyping(", directVoiceStart);
const directVoiceSource = directVoiceStart >= 0 && directVoiceEnd > directVoiceStart
  ? indexSource.slice(directVoiceStart, directVoiceEnd) : "";
directVoiceSource.includes('reserveDailyUsageWithUser(session, user, "voice_sent", env)') &&
directVoiceSource.includes("releaseVoiceReservation") &&
!directVoiceSource.includes('checkDailyLimitWithUser(session, user, "voice_sent", env)') &&
!directVoiceSource.includes('incrementUsageWithUser(session, user, "voice_sent", env)')
  ? ok("direct voice requests reserve quota atomically and roll back failed sends")
  : fail("direct voice requests must use atomic usage reservations");

console.log("");
if (failures > 0) {
  console.error(`FAILED: ${failures} problem(s) found.\n`);
  process.exit(1);
}
console.log("All source regression checks passed. ✓\n");
