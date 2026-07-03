/**
 * Builds footprint candles from a stream of aggTrades.
 * Port of the Python reference (orderflow/feed/binance.py build_bars_footprints +
 * live/stream.py close_bucket): timestamp-driven bucketing, maker-flag delta semantics,
 * floor price binning. Candle close is driven by trade timestamps, never wall-clock
 * timers, so background-tab throttling cannot corrupt candles.
 */
import type { AggTrade, FootprintBin, FootprintCandle } from '../types'

export interface BuilderConfig {
  barMs: number
  priceBin: number
}

interface BinAcc {
  bid: number
  ask: number
}

interface Forming {
  ts: number
  open: number
  high: number
  low: number
  close: number
  volume: number
  delta: number
  cvdOpen: number
  cvdHigh: number
  cvdLow: number
  cvdClose: number
  tradeCount: number
  bins: Map<number, BinAcc>
}

export function binPrice(price: number, bin: number): number {
  return Math.floor(price / bin) * bin
}

function finalize(f: Forming, closed: boolean): FootprintCandle {
  const bins: FootprintBin[] = [...f.bins.entries()]
    .map(([price, b]) => ({ price, bidVol: b.bid, askVol: b.ask }))
    .sort((a, b) => a.price - b.price)
  let maxDelta = 0
  let minDelta = 0
  for (const b of bins) {
    const d = b.askVol - b.bidVol
    if (d > maxDelta) maxDelta = d
    if (d < minDelta) minDelta = d
  }
  return {
    ts: f.ts,
    open: f.open,
    high: f.high,
    low: f.low,
    close: f.close,
    volume: f.volume,
    delta: f.delta,
    cvdOpen: f.cvdOpen,
    cvdHigh: f.cvdHigh,
    cvdLow: f.cvdLow,
    cvdClose: f.cvdClose,
    tradeCount: f.tradeCount,
    closed,
    bins,
    maxDelta,
    minDelta,
  }
}

export class CandleBuilder {
  private cfg: BuilderConfig
  private forming: Forming | null = null
  private cvd = 0

  constructor(cfg: BuilderConfig) {
    this.cfg = cfg
  }

  /** Feed one trade. Returns the just-closed candle when this trade opens a new bucket, else null. */
  push(t: AggTrade): FootprintCandle | null {
    const bucket = Math.floor(t.time / this.cfg.barMs) * this.cfg.barMs
    let closedCandle: FootprintCandle | null = null

    if (this.forming && bucket !== this.forming.ts) {
      closedCandle = finalize(this.forming, true)
      this.forming = null
    }

    if (!this.forming) {
      this.forming = {
        ts: bucket,
        open: t.price,
        high: t.price,
        low: t.price,
        close: t.price,
        volume: 0,
        delta: 0,
        cvdOpen: this.cvd,
        cvdHigh: this.cvd,
        cvdLow: this.cvd,
        cvdClose: this.cvd,
        tradeCount: 0,
        bins: new Map(),
      }
    }

    const f = this.forming
    f.high = Math.max(f.high, t.price)
    f.low = Math.min(f.low, t.price)
    f.close = t.price
    f.volume += t.qty
    f.tradeCount++

    // isBuyerMaker=true -> aggressor SOLD into the bid -> bid volume, negative delta
    const signed = t.isBuyerMaker ? -t.qty : t.qty
    f.delta += signed
    this.cvd += signed
    f.cvdClose = this.cvd
    if (this.cvd > f.cvdHigh) f.cvdHigh = this.cvd
    if (this.cvd < f.cvdLow) f.cvdLow = this.cvd

    const bp = binPrice(t.price, this.cfg.priceBin)
    const bin = f.bins.get(bp) ?? { bid: 0, ask: 0 }
    if (t.isBuyerMaker) bin.bid += t.qty
    else bin.ask += t.qty
    f.bins.set(bp, bin)

    return closedCandle
  }

  /** Snapshot of the currently forming candle (closed=false), or null before the first trade. */
  current(): FootprintCandle | null {
    return this.forming ? finalize(this.forming, false) : null
  }

  /** Seed the cumulative CVD baseline (e.g. 0 at session start, or a warmed-up value). */
  seedCvd(value: number): void {
    this.cvd = value
  }
}
