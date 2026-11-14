# Changelog

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
