/**
 * Analysis session lifecycle: arm a key level, feed closed candles, get score
 * snapshots + commentary out. Pure core — the UI controller owns feed wiring.
 */
import type {
  CandleMetrics,
  Direction,
  FootprintCandle,
  LevelKind,
  ScoreSnapshot,
} from '../types'
import { toCandleMetrics, DEFAULT_METRICS_CONFIG, type MetricsConfig } from '../metrics/candleMetrics'
import type { DivergenceState } from '../metrics/cvd'
import { scoreSetup, DEFAULT_SCORE_CONFIG, type ScoreConfig } from '../scoring/score'
import { describeCandle, describeScoreChange, type CommentaryEvent } from '../scoring/commentary'

export interface ArmParams {
  level: number
  /** price side decides geometry: price above level => support, below => resistance */
  currentPrice: number
  trend: Direction
  isRetest: boolean
}

export interface SessionUpdate {
  snapshot: ScoreSnapshot
  events: CommentaryEvent[]
  metrics: CandleMetrics[]
}

export class AnalysisSession {
  readonly level: number
  readonly levelKind: LevelKind
  readonly attack: Direction
  readonly trend: Direction
  readonly isRetest: boolean
  readonly armedAt: number
  private metricsCfg: MetricsConfig
  private scoreCfg: ScoreConfig
  private metrics: CandleMetrics[] = []
  private candles: FootprintCandle[] = []
  private cvdDivergence = false
  private lastSnapshot: ScoreSnapshot | null = null

  constructor(params: ArmParams, metricsCfg = DEFAULT_METRICS_CONFIG, scoreCfg = DEFAULT_SCORE_CONFIG) {
    this.level = params.level
    this.levelKind = params.currentPrice >= params.level ? 'support' : 'resistance'
    this.attack = this.levelKind === 'support' ? 'down' : 'up'
    this.trend = params.trend
    this.isRetest = params.isRetest
    this.armedAt = Date.now()
    this.metricsCfg = metricsCfg
    this.scoreCfg = scoreCfg
  }

  get cvdDivergenceSeen(): boolean {
    return this.cvdDivergence
  }

  get candleMetrics(): CandleMetrics[] {
    return this.metrics
  }

  get rawCandles(): FootprintCandle[] {
    return this.candles
  }

  get snapshot(): ScoreSnapshot | null {
    return this.lastSnapshot
  }

  /**
   * Feed one CLOSED timeframe candle plus the divergence state at that close.
   * Divergence against the attack is sticky for the rest of the session:
   * bullish divergence undermines a down attack, bearish an up attack.
   */
  onCandleClose(candle: FootprintCandle, divergence: DivergenceState): SessionUpdate {
    if ((this.attack === 'down' && divergence.bullish) || (this.attack === 'up' && divergence.bearish)) {
      this.cvdDivergence = true
    }
    this.candles.push(candle)
    const m = toCandleMetrics(candle, this.metricsCfg)
    this.metrics.push(m)

    const snapshot = scoreSetup(
      {
        levelKind: this.levelKind,
        attack: this.attack,
        trend: this.trend,
        cvdDivergence: this.cvdDivergence,
        candles: this.metrics,
      },
      this.scoreCfg,
    )

    const events: CommentaryEvent[] = [
      describeCandle(this.metrics.length, m),
      ...describeScoreChange(this.lastSnapshot, snapshot),
    ]
    this.lastSnapshot = snapshot
    return { snapshot, events, metrics: this.metrics }
  }
}
