/**
 * Assembles a dataset.json-shaped SessionRecord from an analysis session's
 * candle metrics plus the user's outcome labels.
 */
import type { CandleMetrics, Direction, Scenario, SessionRecord } from '../types'

const r2 = (x: number): number => Math.round(x * 100) / 100

/** Default winning-move direction implied by each scenario (editable in the modal). */
export function impliedDirection(scenario: Scenario): 'buy' | 'sell' {
  switch (scenario) {
    case 'touch_and_reject_up':
    case 'break_up':
    case 'break_up_and_retest_success':
    case 'break_down_and_retest_fail':
      return 'buy'
    case 'touch_and_reject_down':
    case 'break_down':
    case 'break_up_and_retest_fail':
    case 'break_down_and_retest_success':
      return 'sell'
  }
}

export function scenariosForLevel(levelKind: 'support' | 'resistance'): Scenario[] {
  return levelKind === 'support'
    ? ['touch_and_reject_up', 'break_down', 'break_up_and_retest_success', 'break_up_and_retest_fail']
    : ['touch_and_reject_down', 'break_up', 'break_down_and_retest_success', 'break_down_and_retest_fail']
}

export function buildRecord(params: {
  recordId: number
  scenario: Scenario
  trend: Direction
  winTradeDirection: 'buy' | 'sell'
  cvdDivergence: boolean
  metrics: CandleMetrics[]
}): SessionRecord {
  return {
    record_id: params.recordId,
    scenario: params.scenario,
    trend: params.trend,
    win_trade_direction: params.winTradeDirection,
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
