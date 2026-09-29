# Handoff — orderflow-live (read this first in a new session)

Last updated: 2026-09-29. Written so a fresh Claude Code session (any account) can resume work with zero lost context.

## What this project is

A live order-flow analysis web app for crypto pairs (Binance data). User draws a **key zone** (support/resistance range) the way they already do on TradingView, arms it in this app, and the app scores every closed candle as **REJECT** (zone holds) vs **BREAK** (zone fails) using a weighted priority model derived from a hand-labelled dataset. See `GUIDE.md` in this repo for the full user-facing explanation.

## Where things live

- **This repo** (`orderflow-live`): GitHub `dhanushkacc/orderflow-live`, branch `main`. This IS the source of truth — always pull/clone from here first in a new session, don't rely on any local path matching the old machine.
- **Sibling project** `C:\Users\DELL\trading-strategy` (separate repo, NOT this one): the original Python order-flow research project (dataset.json master copy, Pine scripts, the walk-forward strategy builder, a Hermes agent integration). `dataset.json` there was migrated to the same schema as this app (see below) — keep both in sync if you hand-edit records in one place.
- Claude's local **memory files** (topic: trading strategy, footprint dataset, this webapp) live under `C:\Users\DELL\.claude\projects\...\memory\` on the old machine/account. Those may or may not be visible to a new session depending on how the new account's project path resolves — **do not assume the new session has them**. This HANDOFF.md plus the repo's own docs (`README.md`, `GUIDE.md`) are the reliable substitute.

## Status: what's built (all merged to `main`, all verified live)

| Milestone | Status |
|---|---|
| M0 Scaffold (Vite+React+TS, Tailwind v4, vitest) | done |
| M1 Binance feed (WS aggTrade+depth, REST backfill, reconnect) | done, live-verified |
| M2 Candle builder + aggregation + metrics + CVD + volume profile | done, verified tick-exact vs Binance's own kline |
| M3 v3 scoring engine (P1–P6 weighted priorities) | done — **acceptance test replays the 16-record dataset and must reproduce 13 hits / 2 misses (#8, #14) / 1 tie (#11) exactly.** This is the regression gate — never change scoring math without it passing. |
| M4 Dashboard UI (chart, bias gauge, score breakdown, commentary) | done, live-verified |
| M5 Dominance/depth panel (aggressive vs passive, walls, absorption events) | done |
| M6 Outcome labeling + localStorage + dataset import/export | done |
| Zone-based key levels (not single line) | done — type high/low or click chart twice |
| Sri Lanka time (Asia/Colombo, +5:30) everywhere | done — chart axis, commentary clock, candle time labels |
| Simplified schema: `scenario` → `level_kind` + `outcome`(reject/break) + `retest` | done — both dataset.json copies migrated; legacy files auto-upgrade on import |
| `GUIDE.md` — full user guide | done, committed |
| Pushed to GitHub | done (`dhanushkacc/orderflow-live`, all commits above) |

## What's NOT done yet (pick up here)

1. **Vercel deploy — not confirmed live.** Last instruction given: go to vercel.com/new, import `dhanushkacc/orderflow-live`, deploy with defaults (Vite auto-detected, no env vars needed). User had not yet reported back a live URL when this session ended. **Ask the user for the URL, or ask if they still need to do the import.**
2. **Access restriction — discussed, NOT implemented.** User was worried the public Vercel URL is open to anyone. We discussed options (predefined access code baked into the build via env var — recommended; Vercel Password Protection is Pro-plan only; IP allowlist rejected as impractical). **Nothing was coded.** If the user wants it now, implement: a simple gate screen checking a passcode against `VITE_ACCESS_CODE` set in Vercel's environment variables, shown before the Dashboard renders. Keep it lightweight — this is a deterrent, not real auth (acceptable since the app has no sensitive backend, only reads public Binance data).
3. Phase-2 ideas explicitly deferred (see plan file if present, or just ask user): Supabase persistence, PAXG/XAU gold proxy or paid feed, per-symbol score-threshold normalization, Web Worker hardening for background-tab resilience.

## How to resume in a fresh session

```bash
git clone https://github.com/dhanushkacc/orderflow-live.git
cd orderflow-live
npm install
npm run dev        # local dev server, http://localhost:5173
npm test            # must show the acceptance replay test passing (13 hits / 2 misses / 1 tie)
```

Read in this order: `README.md` (architecture) → `GUIDE.md` (user-facing behavior) → this file → `src/core/scoring/score.replay.test.ts` (the pinned scoring semantics, with the exact expected per-record numbers) if touching the scoring engine.

## Key facts worth remembering

- User trades discretionarily on 5m order flow; primary language mix is Sinhala/English (singlish) — respond in English, keep explanations concrete and example-driven, avoid unexplained jargon.
- User's rule: **don't write new test cases or repeat verification loops unnecessarily** — build features fast, rely on the existing acceptance test as the main gate, verify live in the browser preview when a change is visually observable rather than adding more automated tests.
- The scoring model was trained on only 16 hand-labelled setups — always caveat that the backtest (13/16) is in-sample, and that growing the dataset via the in-app labeling flow is the whole point of the live tool.
- Never invent footprint numbers (volume/delta/max_delta/min_delta) when reading from screenshots or any data source — read them exactly or say they're missing. This rule carried over from the original dataset-building work in `trading-strategy` and should still apply to any manual dataset editing.
