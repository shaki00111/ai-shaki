# Changelog

## Unreleased
- Add Groq numbered-key rotation, text-only Gemini fallback, owner provider controls, and credential health checks. Groq remains a text fallback and does not replace image, file, voice, or tool providers.

## Unreleased

- Add admin-opt-in daily group promotion: `/promo on`, `/promo off`, and `/promo status`; only consenting groups receive at most one promotional post per 24 hours, with private-chat, add-to-group, and share links.
- Handle Telegram's `startgroup=add_shaki` payload with a localized group welcome, and add a private-menu share-with-friends link.

- Add a localized **Add AI SHAKI to a Group** button to the private start/home menus, opening Telegram's native group picker via the `startgroup` deep link.
- Add an expandable Persian owner-panel guide covering all 48 roadmap items, exact admin-panel paths, supported commands, update announcements, API-key setup, known limitations, and troubleshooting; pending items are explicitly marked rather than presented as working.

- Make the admin panel's all-audience update announcement reach registered private members and known groups/supergroups in resumable batches, with split counts, progress, cancellation, and a ready-to-edit Persian update template.
- Keep group error messages user-friendly and send redacted technical diagnostics privately to the owner with per-group rate limiting.

- Store Gemini cooldowns under SHA-256 identifiers with monotonic D1 upserts and best-effort migration of the legacy raw-key map; existing backups and old isolates are unaffected.
- Rebuild the Gemini key pool from authoritative environment and managed keys after owner updates, avoiding stale deleted keys and protecting the last active key.
- Bound replied-photo downloads before image editing to reduce Worker memory and deadline exposure.
- Extract bounded DOCX body text locally before model analysis, including for replied-to documents; reject oversized or malformed archives rather than trusting unsupported inline MIME types.
- Add private user-managed text shortcuts (`/shortcut`, `/go`) with per-user D1 isolation and an atomic 20-item cap.
- Add `/anime` and `/cartoon` shortcuts for editing a replied-to image through the existing image-edit pipeline.
- Add `/quiz`, a group-admin-started daily quiz using anonymous native Telegram polls.
- Add `/card` to turn a short message or replied-to text into a self-contained dark SVG quote card.
- Add text-to-image shortcuts `/avatar`, `/duo`, `/story`, and `/meme` using the existing image quota and Cloudflare generation path.
- Add `/poll` for native anonymous Telegram polls, with input validation, group-admin checks, deduplication and rate limiting.
- Add `/challenge`, a shared daily creative prompt in Persian, English and Arabic, rotating at midnight UTC without an external API or new storage.
- Cover challenge rotation, localization and command wiring with automated tests.
- Detect Gemini quota errors by HTTP/SSE status even when the provider message is generic; immediately rotate eligible keys without repeating a key in the same chat/model attempt.
- Allow bounded immediate quota failover across the Gemini key pool for code generation and redact the active provider key from the covered Gemini and TTS error paths.

## 2026-11-14 — Reliability and validation

- Respect the owner’s WusRouter enable/disable setting during code-generation fallback.
- Default missing Gemini TTS MIME metadata to WAV and cover it with regression tests.
- Treat Cloudflare D1 internal storage resets as transient write failures with bounded backoff.
- Run the full automated test suite five consecutive times in both CI workflows.
- Correct setup instructions for the required webhook secret and document WusRouter and the ElevenLabs key pool.

## 2026-11-08 — AI SHAKI branding and reliability

- Set VIP purchase and support routing to the SHAKI owner account.
- Removed the incorrect owner-offline introduction from private and Business replies.
- Rebranded the document and code-generation engine labels and renamed the embedded font module.
- Kept the upstream NovaAgent attribution and AGPL-3.0 license notices.
- Repaired the test command to reference the test files that actually exist.
- Added the package license metadata and updated CI to Node.js 22 for native TypeScript stripping.
- Kept dashboard-managed Worker variables during Wrangler deployments; keep the owner ID in Cloudflare settings rather than publishing it in this repository.
