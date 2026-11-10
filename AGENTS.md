# moonrock — Agent Guide

> Single source of truth for *how to work on this repo*. Claude and Antigravity both read this (`CLAUDE.md` → `@AGENTS.md`; `GEMINI.md` → pointer). Keep it short. *(Auto-generated 2026-10-29; edit freely — re-runs won't overwrite an existing AGENTS.md.)*

**Brain note (goals, backlog, full context):** `/Users/pushp/Brain2/Projects/moonrock.md`
**GitHub:** https://github.com/p3ji/moonrock
**Stack:** Static HTML/CSS/JS with Cloudflare Worker API and D1 ordering database.

## Run / build / test
- Run: open `index.html`, or `python -m http.server 8000` for full PWA/offline behaviour

## Conventions & gotchas
- Keep this file short; put goals/backlog in the linked Brain note, not here.

## Do NOT
- Commit secrets (`.env`) or large build artifacts.

## Live deployment
- URL: https://cafe.peji.ca
- Cloudflare Worker: `moonrock-cafe`; custom domain managed by Cloudflare.
- Homepage is the Storybook variant.
- Edit `scripts/build-storybook.mjs` and rebuild to change the homepage; `storybook.html` is generated. Back-office invitations use `invites.js` / `invites.css`, loaded by `back.html`.
- Deploy from this folder: `node scripts/prepare-deploy.mjs` then `npx wrangler deploy`.
- Verify live model rendering, menu and PDF after deployment.

## Ordering
- Guest UI: `orders.js` / `orders.css`; host UI: `back.html` / `back.js` / `back.css`.
- API: `worker.mjs`; D1 schema: `migrations/`; binding: `DB`.
- Host passcode is private in `.host-access.txt` / `.dev.vars`; never commit or publish either.
- Use Wrangler dev on port 4191 for ordering, not the static HTTP server.
- `scripts/verify-orders.cjs` performs destructive test operations on the local DB only.

## Café robots and lights
- `iot-feed.mjs` serves committed order metadata and authenticated kitchen preferences; no paid APIs.
- The sibling `../IoT/cafe-handoff.js` owns hardware reactions. Do not add a second browser-to-localhost trigger.
- Run `node scripts/verify-iot-handoff.mjs` for isolated Worker/hub checks and `node scripts/verify-iot-kitchen.cjs` against the prepared static preview on port 49193 for mocked browser checks.
- Live on Cloudflare as of 2026-11-10; the local IoT hub has been restarted. Refresh open kitchen tabs after releases. No schema migration is needed.
