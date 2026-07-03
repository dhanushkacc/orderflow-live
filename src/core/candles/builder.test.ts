import { describe, it, expect } from 'vitest'
import { CandleBuilder, binPrice } from './builder'
import { mergeCandles, aggregateSeries } from './aggregate'
import type { AggTrade } from '../types'

const T0 = 1_719_900_000_000 // aligned to a minute boundary
const trade = (id: number, price: number, qty: number, time: number, sell: boolean): AggTrade => ({
  id,
  price,
  qty,
  time,
  isBuyerMaker: sell,
})

describe('binPrice', () => {
  it('floors to the bin', () => {
    expect(binPrice(43215.7, 10)).toBe(43210)
    expect(binPrice(99.99, 10)).toBe(90)
    expect(binPrice(100, 10)).toBe(100)
  })
})

describe('CandleBuilder', () => {
  it('accumulates OHLCV, delta and per-bin volumes with maker semantics', () => {
    const b = new CandleBuilder({ barMs: 60_000, priceBin: 10 })
    // buy aggressor 2 @ 105 -> bin 100 askVol
    expect(b.push(trade(1, 105, 2, T0 + 1000, false))).toBeNull()
    // sell aggressor 5 @ 112 -> bin 110 bidVol
    expect(b.push(trade(2, 112, 5, T0 + 2000, true))).toBeNull()
    // buy aggressor 1 @ 99 -> bin 90 askVol
    expect(b.push(trade(3, 99, 1, T0 + 3000, false))).toBeNull()

    const cur = b.current()!
    expect(cur.open).toBe(105)
    expect(cur.high).toBe(112)
    expect(cur.low).toBe(99)
    expect(cur.close).toBe(99)
    expect(cur.volume).toBe(8)
    expect(cur.delta).toBe(2 - 5 + 1) // -2
    expect(cur.tradeCount).toBe(3)
    expect(cur.bins).toEqual([
      { price: 90, bidVol: 0, askVol: 1 },
      { price: 100, bidVol: 0, askVol: 2 },
      { price: 110, bidVol: 5, askVol: 0 },
    ])
    // per-bin delta extremes: bin90 +1, bin100 +2, bin110 -5
    expect(cur.maxDelta).toBe(2)
    expect(cur.minDelta).toBe(-5)
  })

  it('closes the bucket when a trade crosses the boundary (timestamp-driven)', () => {
    const b = new CandleBuilder({ barMs: 60_000, priceBin: 10 })
    b.push(trade(1, 100, 1, T0 + 500, false))
    const closed = b.push(trade(2, 101, 1, T0 + 60_000, false)) // exactly at next bucket
    expect(closed).not.toBeNull()
    expect(closed!.closed).toBe(true)
    expect(closed!.ts).toBe(T0)
    expect(closed!.volume).toBe(1)
    const forming = b.current()!
    expect(forming.ts).toBe(T0 + 60_000)
    expect(forming.closed).toBe(false)
  })

  it('tracks the intra-candle CVD path (OHLC of cumulative delta)', () => {
    const b = new CandleBuilder({ barMs: 60_000, priceBin: 10 })
    b.push(trade(1, 100, 3, T0 + 1000, false)) // cvd +3
    b.push(trade(2, 100, 8, T0 + 2000, true)) //  cvd -5
    b.push(trade(3, 100, 4, T0 + 3000, false)) // cvd -1
    const c = b.current()!
    expect(c.cvdOpen).toBe(0)
    expect(c.cvdHigh).toBe(3)
    expect(c.cvdLow).toBe(-5)
    expect(c.cvdClose).toBe(-1)
  })

  it('carries CVD across candles', () => {
    const b = new CandleBuilder({ barMs: 60_000, priceBin: 10 })
    b.push(trade(1, 100, 3, T0 + 1000, false))
    b.push(trade(2, 100, 1, T0 + 61_000, true))
    const c2 = b.current()!
    expect(c2.cvdOpen).toBe(3)
    expect(c2.cvdClose).toBe(2)
  })
})

describe('aggregation', () => {
  function candleAt(ts: number, seed: number) {
    const b = new CandleBuilder({ barMs: 60_000, priceBin: 10 })
    b.push(trade(seed, 100 + seed, 2, ts + 1000, false))
    b.push(trade(seed + 1, 100 + seed + 5, 3, ts + 2000, true))
    b.push(trade(seed + 2, 100 + seed, 1, ts + 60_000, false)) // closes it
    return b
  }

  it('merges bins by price and recomputes extremes', () => {
    const b = new CandleBuilder({ barMs: 60_000, priceBin: 10 })
    b.push(trade(1, 105, 2, T0 + 1000, false))
    const c1 = b.push(trade(2, 105, 4, T0 + 61_000, true))! // closes minute 1
    const c2raw = b.current()!
    const merged = mergeCandles([c1, { ...c2raw, closed: true }], T0)
    expect(merged.volume).toBe(6)
    expect(merged.delta).toBe(2 - 4)
    // both trades in bin 100: ask 2, bid 4 -> per-bin delta -2
    expect(merged.bins).toEqual([{ price: 100, bidVol: 4, askVol: 2 }])
    expect(merged.maxDelta).toBe(0)
    expect(merged.minDelta).toBe(-2)
    expect(merged.cvdOpen).toBe(c1.cvdOpen)
    expect(merged.cvdClose).toBe(c2raw.cvdClose)
  })

  it('groups a 1m series into 3m buckets', () => {
    const candles = [0, 1, 2, 3, 4, 5].map((i) => {
      const bld = candleAt(T0 + i * 60_000, i * 10 + 1)
      return { ...bld.current()!, ts: T0 + i * 60_000, closed: true }
    })
    const agg = aggregateSeries(candles, 180_000)
    expect(agg).toHaveLength(2)
    expect(agg[0].ts).toBe(T0)
    expect(agg[1].ts).toBe(T0 + 180_000)
  })
})
