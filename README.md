# orderflow-live

Live order-flow analysis at key levels for Binance crypto pairs. When price approaches a key level, arm the analyzer with that level — the app consumes live Binance trade + depth data, builds footprint candles (volume, delta, min/max delta, absorption, wick location, CVD), and runs a weighted priority scoring engine that shows a live **REJECT vs BREAK** bias gauge with plain-language commentary. After the move resolves, label the real outcome to grow the training dataset.

The scoring model (v3 priority score, P1–P6) was derived from a hand-labelled dataset of key-level interactions; the engine's acceptance test replays that dataset and must reproduce its documented backtest exactly.

## Stack

- Vite + React + TypeScript (strict), Tailwind v4, zustand, lightweight-charts
- 100% client-side — Binance public WebSocket/REST, no API key, no backend
- Persistence: localStorage + dataset.json import/export (Supabase planned phase 2)

## Run

```
npm install
npm run dev      # local dev server
npm test         # vitest — includes the dataset replay acceptance test
npm run build    # production build (deploys static to Vercel)
```

## Architecture

`src/core/**` is a pure-TS portable engine (no react/dom imports) — all analysis logic lives there so it can later move to a Web Worker or server:

```
core/candles   aggTrades -> footprint candles (1m base, 3m/5m aggregation)
core/metrics   absorption / price-action / CVD divergence / volume profile
core/scoring   v3 weighted priority score (P1-P6) + commentary
core/session   arm -> analyze -> label -> record lifecycle
core/depth     order-book walls, imbalance, passive absorption
feed/          Binance WS + REST clients
storage/       localStorage + dataset.json import/export
ui/            dashboard (chart, bias gauge, score breakdown, commentary)
```
