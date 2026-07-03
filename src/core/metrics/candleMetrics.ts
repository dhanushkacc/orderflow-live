/**
 * Derives the human-comparable per-candle labels used by the dataset and the
 * scoring engine from a raw FootprintCandle. Thresholds are configurable so
 * they can be calibrated against Dilshan's hand labels.
 */
import type { CandleMetrics, FootprintCandle, Zone } from '../types'

export interface MetricsConfig {
  /** dominant wick must exceed body AND be this multiple of the opposite wick to count as price action */
  wickDominance: number
}

export const DEFAULT_METRICS_CONFIG: MetricsConfig = {
  wickDominance: 1.25,
}

/**
 * Absorption side: where the candle's traded volume concentrated.
 * Splits the candle's price range into thirds and compares bin volume in the
 * top third vs the bottom third. Dataset labels are always above/below (never null),
 * so ties resolve to 'above'.
 */
export function absorptionSide(c: FootprintCandle): 'above' | 'below' {
  if (c.bins.length === 0 || c.high === c.low) return 'above'
  const third = (c.high - c.low) / 3
  const lowCut = c.low + third
  const highCut = c.high - third
  let topVol = 0
  let bottomVol = 0
  for (const b of c.bins) {
    const v = b.bidVol + b.askVol
    if (b.price >= highCut) topVol += v
    else if (b.price < lowCut) bottomVol += v
  }
  return topVol >= bottomVol ? 'above' : 'below'
}

/** Wick-based price action: dominant wick bigger than body and clearly one-sided, else null. */
export function priceActionZone(open: number, high: number, low: number, close: number, cfg: MetricsConfig): Zone {
  const body = Math.abs(close - open)
  const upper = high - Math.max(open, close)
  const lower = Math.min(open, close) - low
  const dominant = Math.max(upper, lower)
  const other = Math.min(upper, lower)
  if (dominant <= body) return null
  if (other > 0 && dominant < cfg.wickDominance * other) return null
  return upper > lower ? 'above' : 'below'
}

/** Candle stamp in Sri Lanka time (Asia/Colombo), matching the dataset's HH:MM convention. */
export function candleTimeLabel(ts: number): string {
  return new Date(ts).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Colombo',
  })
}

export function toCandleMetrics(
  c: FootprintCandle,
  cfg: MetricsConfig = DEFAULT_METRICS_CONFIG,
): CandleMetrics {
  return {
    time: candleTimeLabel(c.ts),
    absorption: absorptionSide(c),
    price_action: priceActionZone(c.open, c.high, c.low, c.close, cfg),
    cvd_price_action: priceActionZone(c.cvdOpen, c.cvdHigh, c.cvdLow, c.cvdClose, cfg),
    volume: c.volume,
    delta: c.delta,
    max_delta: c.maxDelta,
    min_delta: c.minDelta,
  }
}
