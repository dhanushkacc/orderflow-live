/**
 * Aggregates base 1m footprint candles into higher timeframes (3m/5m).
 * Bins merge by price, per-bin delta extremes are recomputed from the merged
 * bins, and the CVD OHLC path merges exactly — so switching timeframe never
 * loses footprint fidelity.
 */
import type { FootprintBin, FootprintCandle } from '../types'

/** Merge a group of consecutive candles (ascending ts) into one candle stamped at the group bucket. */
export function mergeCandles(group: FootprintCandle[], bucketTs: number): FootprintCandle {
  if (group.length === 0) throw new Error('mergeCandles: empty group')
  const first = group[0]
  const last = group[group.length - 1]

  const binMap = new Map<number, { bid: number; ask: number }>()
  let volume = 0
  let delta = 0
  let tradeCount = 0
  let high = -Infinity
  let low = Infinity
  let cvdHigh = -Infinity
  let cvdLow = Infinity

  for (const c of group) {
    volume += c.volume
    delta += c.delta
    tradeCount += c.tradeCount
    if (c.high > high) high = c.high
    if (c.low < low) low = c.low
    if (c.cvdHigh > cvdHigh) cvdHigh = c.cvdHigh
    if (c.cvdLow < cvdLow) cvdLow = c.cvdLow
    for (const b of c.bins) {
      const acc = binMap.get(b.price) ?? { bid: 0, ask: 0 }
      acc.bid += b.bidVol
      acc.ask += b.askVol
      binMap.set(b.price, acc)
    }
  }

  const bins: FootprintBin[] = [...binMap.entries()]
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
    ts: bucketTs,
    open: first.open,
    high,
    low,
    close: last.close,
    volume,
    delta,
    cvdOpen: first.cvdOpen,
    cvdHigh,
    cvdLow,
    cvdClose: last.cvdClose,
    tradeCount,
    closed: group.every((c) => c.closed),
    bins,
    maxDelta,
    minDelta,
  }
}

/** Aggregate a 1m series into targetMs candles (targetMs must be a multiple of the base bar). */
export function aggregateSeries(base: FootprintCandle[], targetMs: number): FootprintCandle[] {
  const groups = new Map<number, FootprintCandle[]>()
  for (const c of base) {
    const bucket = Math.floor(c.ts / targetMs) * targetMs
    const g = groups.get(bucket) ?? []
    g.push(c)
    groups.set(bucket, g)
  }
  return [...groups.entries()]
    .sort(([a], [b]) => a - b)
    .map(([bucket, g]) => mergeCandles(g.sort((a, b) => a.ts - b.ts), bucket))
}
