/**
 * Order-book + tape dominance metrics: who is aggressive, who is passive,
 * where the walls are, and whether passive players are absorbing at the level.
 */
import type { AggTrade, DepthSnapshot } from '../types'

export interface Wall {
  side: 'bid' | 'ask'
  price: number
  qty: number
  /** multiple of the side's median level size */
  strength: number
}

export interface DominanceState {
  /** rolling aggressive delta over the window (buy market volume - sell market volume) */
  aggrDelta: number
  aggrBuyVol: number
  aggrSellVol: number
  /** (bidQty - askQty) / (bidQty + askQty) across the visible book, -1..1 */
  bookImbalance: number
  /** combined read for the panel */
  verdict: 'buyers_aggressive' | 'sellers_aggressive' | 'balanced'
  passiveSupport: 'bids_stacked' | 'asks_stacked' | 'balanced'
  walls: Wall[]
}

export interface AbsorptionEvent {
  ts: number
  side: 'bid' | 'ask'
  price: number
  text: string
}

const median = (xs: number[]): number => {
  if (xs.length === 0) return 0
  const s = [...xs].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

export function findWalls(depth: DepthSnapshot, minStrength = 3): Wall[] {
  const walls: Wall[] = []
  for (const [side, levels] of [['bid', depth.bids], ['ask', depth.asks]] as const) {
    const med = median(levels.map(([, q]) => q))
    if (med === 0) continue
    for (const [price, qty] of levels) {
      const strength = qty / med
      if (strength >= minStrength) walls.push({ side, price, qty, strength })
    }
  }
  return walls.sort((a, b) => b.strength - a.strength).slice(0, 6)
}

export function bookImbalance(depth: DepthSnapshot): number {
  const bid = depth.bids.reduce((s, [, q]) => s + q, 0)
  const ask = depth.asks.reduce((s, [, q]) => s + q, 0)
  const total = bid + ask
  return total === 0 ? 0 : (bid - ask) / total
}

/** Rolling window over the tape + latest book snapshot -> dominance verdict. */
export class DominanceTracker {
  private windowMs: number
  private trades: AggTrade[] = []

  constructor(windowMs = 60_000) {
    this.windowMs = windowMs
  }

  pushTrade(t: AggTrade): void {
    this.trades.push(t)
    const cutoff = t.time - this.windowMs
    while (this.trades.length > 0 && this.trades[0].time < cutoff) this.trades.shift()
  }

  compute(depth: DepthSnapshot | null): DominanceState {
    let buy = 0
    let sell = 0
    for (const t of this.trades) {
      if (t.isBuyerMaker) sell += t.qty
      else buy += t.qty
    }
    const aggrDelta = buy - sell
    const total = buy + sell
    const imb = depth ? bookImbalance(depth) : 0
    const walls = depth ? findWalls(depth) : []

    const aggrRatio = total === 0 ? 0 : aggrDelta / total
    const verdict =
      aggrRatio > 0.15 ? 'buyers_aggressive' : aggrRatio < -0.15 ? 'sellers_aggressive' : 'balanced'
    const passiveSupport = imb > 0.2 ? 'bids_stacked' : imb < -0.2 ? 'asks_stacked' : 'balanced'

    return { aggrDelta, aggrBuyVol: buy, aggrSellVol: sell, bookImbalance: imb, verdict, passiveSupport, walls }
  }
}

/**
 * Passive absorption detector: a burst of aggressive volume into one side while
 * the best price on that side holds — passive orders eating the attack.
 */
export class AbsorptionDetector {
  private burstWindowMs: number
  private burstMult: number
  private recent: AggTrade[] = []
  private baseline = 0

  constructor(burstWindowMs = 5_000, burstMult = 4) {
    this.burstWindowMs = burstWindowMs
    this.burstMult = burstMult
  }

  /** Returns an event when an absorbed burst is detected at this trade. */
  push(t: AggTrade, depth: DepthSnapshot | null): AbsorptionEvent | null {
    this.recent.push(t)
    const cutoff = t.time - this.burstWindowMs
    while (this.recent.length > 0 && this.recent[0].time < cutoff) this.recent.shift()

    const sellBurst = this.recent.filter((x) => x.isBuyerMaker).reduce((s, x) => s + x.qty, 0)
    const buyBurst = this.recent.filter((x) => !x.isBuyerMaker).reduce((s, x) => s + x.qty, 0)
    const burst = Math.max(sellBurst, buyBurst)

    // EMA baseline of burst volume
    this.baseline = this.baseline === 0 ? burst : this.baseline * 0.98 + burst * 0.02
    if (this.baseline === 0 || burst < this.burstMult * this.baseline || !depth) return null

    const priceRange = this.recent[this.recent.length - 1].price - this.recent[0].price
    const sellSide = sellBurst > buyBurst
    // absorbed = heavy one-way volume but price barely moved against the defenders
    const held = sellSide ? priceRange >= -0.0005 * t.price : priceRange <= 0.0005 * t.price
    if (!held) return null

    this.recent = []
    return {
      ts: t.time,
      side: sellSide ? 'bid' : 'ask',
      price: t.price,
      text: sellSide
        ? `sell burst ${sellBurst.toFixed(2)} absorbed by passive bids near ${t.price}`
        : `buy burst ${buyBurst.toFixed(2)} absorbed by passive asks near ${t.price}`,
    }
  }
}
