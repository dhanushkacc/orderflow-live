import { describe, it, expect } from 'vitest'
import { absorptionSide, priceActionZone, DEFAULT_METRICS_CONFIG } from './candleMetrics'
import { CvdDivergenceDetector } from './cvd'
import { computeProfile } from './profile'
import type { Candle, FootprintCandle } from '../types'

const fc = (partial: Partial<FootprintCandle>): FootprintCandle => ({
  ts: 0,
  open: 100,
  high: 110,
  low: 90,
  close: 105,
  volume: 0,
  delta: 0,
  cvdOpen: 0,
  cvdHigh: 0,
  cvdLow: 0,
  cvdClose: 0,
  tradeCount: 0,
  closed: true,
  bins: [],
  maxDelta: 0,
  minDelta: 0,
  ...partial,
})

describe('absorptionSide', () => {
  it('above when volume concentrates in the top third', () => {
    const c = fc({
      high: 120,
      low: 90,
      bins: [
        { price: 115, bidVol: 50, askVol: 40 }, // top third (>= 110)
        { price: 100, bidVol: 5, askVol: 5 },
        { price: 92, bidVol: 10, askVol: 5 }, // bottom third (< 100)
      ],
    })
    expect(absorptionSide(c)).toBe('above')
  })

  it('below when volume concentrates at the lows', () => {
    const c = fc({
      high: 120,
      low: 90,
      bins: [
        { price: 92, bidVol: 60, askVol: 30 },
        { price: 111, bidVol: 4, askVol: 3 },
      ],
    })
    expect(absorptionSide(c)).toBe('below')
  })
})

describe('priceActionZone', () => {
  const cfg = DEFAULT_METRICS_CONFIG
  it('below when the lower wick dominates the body', () => {
    // o 100 c 101 (body 1), low 95 (lower wick 5), high 101.5 (upper 0.5)
    expect(priceActionZone(100, 101.5, 95, 101, cfg)).toBe('below')
  })
  it('above when the upper wick dominates', () => {
    expect(priceActionZone(100, 106, 99.5, 100.5, cfg)).toBe('above')
  })
  it('null when the body dominates', () => {
    expect(priceActionZone(100, 105.5, 99.5, 105, cfg)).toBeNull()
  })
  it('null when both wicks are similar (indecision, not one-sided rejection)', () => {
    expect(priceActionZone(100, 104, 96, 100.5, cfg)).toBeNull()
  })
})

describe('CvdDivergenceDetector', () => {
  const candle = (high: number, low: number, cvdHigh: number, cvdLow: number): Candle => ({
    ts: 0,
    open: 0,
    high,
    low,
    close: 0,
    volume: 0,
    delta: 0,
    cvdOpen: 0,
    cvdHigh,
    cvdLow,
    cvdClose: 0,
    tradeCount: 0,
    closed: true,
  })

  it('flags bearish divergence: new price high without a new CVD high', () => {
    const d = new CvdDivergenceDetector(10)
    d.push(candle(100, 95, 50, 40))
    d.push(candle(101, 96, 60, 45))
    const s = d.push(candle(105, 97, 55, 46)) // price high 105 > 101, cvd 55 <= 60
    expect(s.bearish).toBe(true)
    expect(s.bullish).toBe(false)
  })

  it('flags bullish divergence: new price low without a new CVD low', () => {
    const d = new CvdDivergenceDetector(10)
    d.push(candle(100, 95, 50, 40))
    d.push(candle(99, 94, 48, 35))
    const s = d.push(candle(98, 90, 47, 36)) // low 90 < 94 but cvdLow 36 >= 35
    expect(s.bullish).toBe(true)
  })

  it('no divergence when CVD confirms', () => {
    const d = new CvdDivergenceDetector(10)
    d.push(candle(100, 95, 50, 40))
    d.push(candle(101, 96, 60, 45))
    const s = d.push(candle(105, 97, 70, 46))
    expect(s.bearish).toBe(false)
  })
})

describe('computeProfile', () => {
  it('finds POC, value area and LVN zones', () => {
    const vp = new Map<number, number>([
      [90, 5],
      [100, 10],
      [110, 100], // POC
      [120, 80],
      [130, 60],
      [140, 4], // thin -> LVN (<= 22)
      [150, 30],
    ])
    const p = computeProfile(vp)!
    expect(p.poc).toBe(110)
    expect(p.totalVolume).toBe(289)
    expect(p.val).toBeLessThanOrEqual(110)
    expect(p.vah).toBeGreaterThanOrEqual(110)
    expect(p.lvnZones).toContainEqual({ from: 90, to: 100 })
    expect(p.lvnZones).toContainEqual({ from: 140, to: 140 })
  })

  it('returns null for empty input', () => {
    expect(computeProfile(new Map())).toBeNull()
  })
})
