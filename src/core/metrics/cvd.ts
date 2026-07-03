/**
 * CVD divergence detection — port of the Python reference
 * (orderflow/features/engine.py rolling-deque divergence).
 * Divergence = price makes a new window extreme but CVD fails to confirm.
 */
import type { Candle } from '../types'

export interface DivergenceState {
  /** price new high, CVD did not confirm — buyers pushing price without flow behind it */
  bearish: boolean
  /** price new low, CVD did not confirm — sellers pushing price without flow behind it */
  bullish: boolean
}

export class CvdDivergenceDetector {
  private lookback: number
  private highs: number[] = []
  private lows: number[] = []
  private cvdHighs: number[] = []
  private cvdLows: number[] = []

  constructor(lookback = 10) {
    this.lookback = lookback
  }

  /** Push a closed candle; returns the divergence state as of this close. */
  push(c: Candle): DivergenceState {
    const state: DivergenceState = { bearish: false, bullish: false }
    if (this.highs.length >= 2) {
      const priorMaxHigh = Math.max(...this.highs)
      const priorMaxCvd = Math.max(...this.cvdHighs)
      const priorMinLow = Math.min(...this.lows)
      const priorMinCvd = Math.min(...this.cvdLows)
      if (c.high > priorMaxHigh && c.cvdHigh <= priorMaxCvd) state.bearish = true
      if (c.low < priorMinLow && c.cvdLow >= priorMinCvd) state.bullish = true
    }
    this.highs.push(c.high)
    this.lows.push(c.low)
    this.cvdHighs.push(c.cvdHigh)
    this.cvdLows.push(c.cvdLow)
    if (this.highs.length > this.lookback) {
      this.highs.shift()
      this.lows.shift()
      this.cvdHighs.shift()
      this.cvdLows.shift()
    }
    return state
  }

  reset(): void {
    this.highs = []
    this.lows = []
    this.cvdHighs = []
    this.cvdLows = []
  }
}
