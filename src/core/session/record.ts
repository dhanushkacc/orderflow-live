/**
 * Assembles a dataset.json-shaped SessionRecord from an analysis session's
 * candle metrics plus the user's outcome label (reject | break).
 */
import type { CandleMetrics, Direction, LevelKind, Outcome, SessionRecord } from '../types'

const r2 = (x: number): number => Math.round(x * 100) / 100

/** Winning-move direction is fully determined by geometry + outcome. */
export function impliedDirection(levelKind: LevelKind, outcome: Outcome): 'buy' | 'sell' {
  if (levelKind === 'support') return outcome === 'reject' ? 'buy' : 'sell'
  return outcome === 'reject' ? 'sell' : 'buy'
}

export function buildRecord(params: {
  recordId: number
  levelKind: LevelKind
  outcome: Outcome
  retest: boolean
  trend: Direction
  cvdDivergence: boolean
  metrics: CandleMetrics[]
}): SessionRecord {
  return {
    record_id: params.recordId,
    level_kind: params.levelKind,
    outcome: params.outcome,
    retest: params.retest,
    trend: params.trend,
    win_trade_direction: impliedDirection(params.levelKind, params.outcome),
    cvd_divergence: params.cvdDivergence,
    candles: params.metrics.map((m, i) => ({
      i: i + 1,
      time: m.time,
      absorption: m.absorption,
      price_action: m.price_action,
      cvd_price_action: m.cvd_price_action,
      volume: m.volume == null ? null : r2(m.volume),
      delta: m.delta == null ? null : r2(m.delta),
      max_delta: m.max_delta == null ? null : r2(m.max_delta),
      min_delta: m.min_delta == null ? null : r2(m.min_delta),
    })),
  }
}
