# orderflow-live — User Guide

A live order-flow assistant. You mark a key **zone**, and when price arrives the app watches the tape candle by candle and tells you — with a reason — whether the zone is more likely to **REJECT** (hold) or **BREAK**. It never places trades; it scores what the order flow is doing so you can decide.

All times shown are **Sri Lanka time (Asia/Colombo, +5:30)**.

---

## 1. The core idea

At any key level there are four players:

| Player | What they do | Footprint clue |
|---|---|---|
| Aggressive buyers | market-buy into the ask | positive delta, rising max delta |
| Aggressive sellers | market-sell into the bid | negative delta, deep min delta |
| Passive buyers | limit bids soaking up selling | big volume at the lows, price holds |
| Passive sellers | limit asks soaking up buying | big volume at the highs, price holds |

A level **breaks** when the defenders (the passive side) are absent — aggression walks straight through. A level **rejects** when every push gets absorbed and price gets thrown back. The app reads exactly this and turns it into a score.

---

## 2. The workflow (how you actually use it)

1. **Analyze on TradingView as usual.** Draw your key level as a zone (rectangle) like you always do.
2. **When price is approaching that zone**, open orderflow-live and pick the same crypto pair (e.g. `BTCUSDT`) and your timeframe (`1m` / `3m` / `5m`).
3. **Arm the zone** — either type the zone's high and low prices, or click the chart twice (1st click = high edge, 2nd click = low edge). Set the **trend** (up/down) and tick **retest** if this is a retest of a level that already broke. Press **Arm**.
4. **Watch.** Every time a candle closes, the bias gauge and score update, and the commentary explains what just happened. The app keeps analyzing until you stop it.
5. **When the move resolves**, press **End & label**, tap **REJECT** or **BREAK** for what actually happened, and **Save**. That grows your dataset and makes the model sharper over time.

That's the whole loop: draw on TV → arm here → watch the score build → label the result.

---

## 3. Reading the screen

### Top bar
- **Pair** selector + free-text box for any Binance pair.
- **Timeframe**: 1m / 3m / 5m.
- **records** count, **export** / **import** for your `dataset.json`.
- Live **price** and a connection dot (green = streaming, amber = reconnecting).

### Chart (left)
- Candles + your armed **zone** (two yellow lines) + a **CVD pane** below (cumulative delta line — the "flow" behind price).
- Under it, a **metric strip** for the last few candles: `vol`, `Δ` (delta), `maxΔ` (biggest buyer punch), `minΔ` (biggest seller punch). Green = buyers, red = sellers.

### Bias gauge (right, top)
- The big word — **REJECT**, **BREAK**, or **NO EDGE** — is the current call.
- The green/red bar is the tug-of-war: reject points vs break points.
- **ACTIONABLE** lights up when the gap between the two sides is **≥ 2** — that's the threshold where the setup is worth acting on. Below that it says "waiting".
- A **retest** banner appears if you armed a retest (treat those with lower confidence — see §5).

### Score breakdown (right)
Six priorities, each showing which side it favours and how strongly. This is the *why* behind the gauge — see §4.

### Participants panel (right)
- Who's **aggressive** right now (rolling 60-second market buy vs sell volume).
- Who's **passive** (order-book imbalance — which side has more resting limit orders).
- **Limit walls**: unusually large resting orders near your zone, with distance to the zone. A big bid wall under support is defenders showing up; if it gets eaten and price holds, that's absorption.

### Commentary (right, bottom)
Plain-language play-by-play, e.g.
*"candle 3: sellers punched −450, volume absorbed below, wick rejecting below"*,
*"bias flipped to REJECT — gap 3"*,
*"sell burst 12.4 absorbed by passive bids near 61,920"*.

---

## 4. The score — the six priorities

The app adds up **reject points** vs **break points**. Higher total wins; trade the side only when the gap is ≥ 2. Each priority is weighted by how reliable it was in the training data.

| # | Priority | Favours REJECT when… | Favours BREAK when… | Weight |
|---|---|---|---|---|
| **P1** | Trend vs attack | the zone is attacked **against** the trend | the zone is attacked **with** the trend | 3 (highest) |
| **P2** | Punch battle | the winning side (by delta size × momentum) defends the zone | the winning side attacks the zone | 1–3 |
| **P3** | One-sided flow | — | a candle shows huge one-way delta with **no** opposing response (defenders absent) | 1–3 |
| **P4** | CVD divergence | flow stops confirming price at the zone (absorption) | — | 2 |
| **P5** | Wick pattern | rejection wicks print **into** the zone late in the move | wicks lean the other way (pullbacks sold back in) | 2 / 1 |
| **P6** | Volume behaviour | volume **rises** into the zone (defenders arriving) | volume **dries up** (no defense) | 1 |

**Plain-English rules that fall out of this:**
- **Trend is king.** A level hit *against* the trend almost always holds. A level only really breaks when it's hit *with* the trend — and even then, read the flow.
- **Big one-sided candles with no push-back = break.** If sellers dump −1000s of delta and buyers don't answer at all, don't try to catch it — that's continuation.
- **Rising volume + rejection wicks + CVD divergence = reject.** The fight is on and the defenders are winning.

---

## 5. Honest limits (read this)

- The model was built from **16 hand-labelled setups**. It scored 13 of 16 correctly in testing — but that is *in-sample* on a small set. Treat the score as a **strong second opinion**, not a guarantee. It will be wrong sometimes.
- **Two known weak spots:** (a) very high-volume grinding levels can look like breaks but hold; (b) **retests** can invert the normal trend logic — that's why retests get a reduced-confidence banner. Both improve as you log more of them.
- The whole point of the **label-after** step is to grow the dataset past 16 so the model gets more reliable. The more you label honestly (including the losers), the better it gets.
- **Crypto only** for now (Binance public data). Gold/XAU isn't on Binance — a proxy or paid feed is a later addition.
- Keep the browser tab **focused** during a live session so the feed isn't throttled by the browser.

---

## 6. Your data

- Records are stored in your browser and seeded with the original 16.
- **Export** downloads `dataset.json` (same format your Python tools use). **Import** loads one back — old scenario-labelled files are upgraded automatically.
- Each saved record keeps: zone side (support/resistance), outcome (reject/break), retest flag, trend, CVD divergence, and every candle's volume / delta / max delta / min delta / absorption / wick — the full footprint of the setup.

---

## 7. Quick start checklist

- [ ] Pick pair + timeframe, confirm the price is streaming (green dot).
- [ ] Price approaching your TradingView zone → type or click the zone high/low here.
- [ ] Set trend, tick retest if needed → **Arm**.
- [ ] Watch the gauge each candle close; act only when it says **ACTIONABLE** (gap ≥ 2).
- [ ] After the move → **End & label** → REJECT / BREAK → **Save**.
- [ ] Occasionally **export** your dataset to back it up.
