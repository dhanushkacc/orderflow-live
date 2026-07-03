/**
 * Core domain types for the order-flow engine.
 * This module (and everything under src/core) must stay framework-free:
 * no react, no dom, no browser globals — portable to a Web Worker or server.
 */

/** Binance aggTrade. isBuyerMaker=true means the BUYER was the passive maker, so the aggressor was a SELLER. */
export interface AggTrade {
  id: number
  price: number
  qty: number
  /** trade time, epoch ms (Binance field T) */
  time: number
  isBuyerMaker: boolean
}

/** Volume at one binned price level inside a candle. bidVol = sell-aggressor volume, askVol = buy-aggressor volume. */
export interface FootprintBin {
  price: number
  bidVol: number
  askVol: number
}

export type Zone = 'above' | 'below' | null

export interface Candle {
  /** bucket open time, epoch ms */
  ts: number
  open: number
  high: number
  low: number
  close: number
  volume: number
  /** buy-aggressor volume minus sell-aggressor volume over the candle */
  delta: number
  cvdOpen: number
  cvdHigh: number
  cvdLow: number
  cvdClose: number
  tradeCount: number
  closed: boolean
}

export interface FootprintCandle extends Candle {
  bins: FootprintBin[]
  /** most positive per-bin delta in the candle (buyer punch) */
  maxDelta: number
  /** most negative per-bin delta in the candle (seller punch) */
  minDelta: number
}

/** Human-comparable per-candle labels, derived programmatically from a FootprintCandle. */
export interface CandleMetrics {
  time: string | null
  absorption: 'above' | 'below'
  price_action: Zone
  cvd_price_action: Zone
  volume: number
  delta: number
  max_delta: number
  min_delta: number
}

export type LevelKind = 'support' | 'resistance'
export type Direction = 'up' | 'down'

export type Scenario =
  | 'break_up'
  | 'break_down'
  | 'break_up_and_retest_success'
  | 'break_down_and_retest_success'
  | 'break_up_and_retest_fail'
  | 'break_down_and_retest_fail'
  | 'touch_and_reject_up'
  | 'touch_and_reject_down'

export interface ScoreInput {
  levelKind: LevelKind
  /** direction of the attack on the level: support is attacked down, resistance up */
  attack: Direction
  trend: Direction
  cvdDivergence: boolean
  candles: CandleMetrics[]
}

export type PriorityId = 'P1' | 'P2' | 'P3' | 'P4' | 'P5' | 'P6'
export type Side = 'RJ' | 'BK'

export interface PriorityContribution {
  id: PriorityId
  /** null when the priority contributed nothing this evaluation */
  side: Side | null
  points: number
  reason: string
  detail: string
}

export interface ScoreSnapshot {
  ts: number
  candleCount: number
  rj: number
  bk: number
  gap: number
  verdict: 'REJECT' | 'BREAK' | 'TIE'
  /** true when gap >= 2 — the trade-worthy threshold from the dataset backtest */
  actionable: boolean
  /** true while the setup has too few candles for stable halves math */
  provisional: boolean
  contributions: PriorityContribution[]
}

/** Exact dataset.json record shape — must round-trip byte-compatibly. */
export interface SessionRecord {
  record_id: number
  scenario: Scenario
  trend: Direction
  win_trade_direction: 'buy' | 'sell'
  cvd_divergence: boolean
  candles: Array<{
    i: number
    time: string | null
    absorption: 'above' | 'below'
    price_action: Zone
    cvd_price_action: Zone
    volume: number | null
    delta: number | null
    max_delta: number | null
    min_delta: number | null
  }>
}

export interface Dataset {
  schema: Record<string, unknown>
  records: SessionRecord[]
}

/** Binance partial depth snapshot (depth20@100ms). */
export interface DepthSnapshot {
  time: number
  bids: Array<[price: number, qty: number]>
  asks: Array<[price: number, qty: number]>
}

export type Timeframe = '1m' | '3m' | '5m'

export const TIMEFRAME_MS: Record<Timeframe, number> = {
  '1m': 60_000,
  '3m': 180_000,
  '5m': 300_000,
}
