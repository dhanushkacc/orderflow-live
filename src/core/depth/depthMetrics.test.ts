import { describe, it, expect } from 'vitest'
import { findWalls, bookImbalance, DominanceTracker } from './depthMetrics'
import type { AggTrade, DepthSnapshot } from '../types'

const depth = (bids: [number, number][], asks: [number, number][]): DepthSnapshot => ({
  time: 0,
  bids,
  asks,
})

describe('findWalls', () => {
  it('flags levels >= 3x the side median', () => {
    const d = depth(
      [
        [100, 1],
        [99, 2],
        [98, 10], // median bid = 2 -> 5x wall
        [97, 2],
      ],
      [
        [101, 1],
        [102, 1],
        [103, 1],
      ],
    )
    const walls = findWalls(d)
    expect(walls).toHaveLength(1)
    expect(walls[0]).toMatchObject({ side: 'bid', price: 98, qty: 10, strength: 5 })
  })
})

describe('bookImbalance', () => {
  it('positive when bids outweigh asks', () => {
    expect(bookImbalance(depth([[100, 30]], [[101, 10]]))).toBeCloseTo(0.5)
    expect(bookImbalance(depth([[100, 10]], [[101, 30]]))).toBeCloseTo(-0.5)
    expect(bookImbalance(depth([], []))).toBe(0)
  })
})

describe('DominanceTracker', () => {
  const trade = (time: number, qty: number, sell: boolean): AggTrade => ({
    id: time,
    price: 100,
    qty,
    time,
    isBuyerMaker: sell,
  })

  it('reads aggressive buyers from the tape', () => {
    const tr = new DominanceTracker(60_000)
    tr.pushTrade(trade(1000, 10, false))
    tr.pushTrade(trade(2000, 2, true))
    const s = tr.compute(null)
    expect(s.aggrBuyVol).toBe(10)
    expect(s.aggrSellVol).toBe(2)
    expect(s.verdict).toBe('buyers_aggressive')
  })

  it('drops trades outside the window', () => {
    const tr = new DominanceTracker(10_000)
    tr.pushTrade(trade(1000, 50, true))
    tr.pushTrade(trade(20_000, 1, false)) // first trade now stale
    const s = tr.compute(null)
    expect(s.aggrSellVol).toBe(0)
    expect(s.aggrBuyVol).toBe(1)
  })

  it('balanced verdict when flow is two-sided', () => {
    const tr = new DominanceTracker(60_000)
    tr.pushTrade(trade(1000, 10, false))
    tr.pushTrade(trade(2000, 10, true))
    expect(tr.compute(null).verdict).toBe('balanced')
  })
})
