/**
 * v3 weighted priority score — predicts whether a key level under attack will
 * REJECT (hold) or BREAK. Semantics are pinned by the dataset acceptance test
 * (replay of the 16 labelled records must yield exactly 13 hits, misses #8 & #14,
 * tie #11). Do not change thresholds without re-running that test.
 *
 * Punch definitions: buyer punch = max_delta (per-price-bin maximum delta),
 * seller punch = |min_delta|. The side whose punch is rising into the level,
 * weighted by magnitude, wins the level; reject/break follows from geometry.
 */
import type {
  CandleMetrics,
  PriorityContribution,
  ScoreInput,
  ScoreSnapshot,
  Side,
} from '../types'

export interface ScoreConfig {
  /** punch/volume trend thresholds: ratio > rising => RISING, < falling => FALLING */
  rising: number
  falling: number
  /** P2 dominance points ladder */
  dominanceStrong: number
  dominanceClear: number
  /** P3 one-sided: opposing punch <= oneSidedFrac * attacking punch */
  oneSidedFrac: number
  /** P3 |delta| ladders (dataset scale — per-symbol config) */
  bigDelta: number
  midDelta: number
  /** actionable when |rj - bk| >= this */
  actionableGap: number
}

export const DEFAULT_SCORE_CONFIG: ScoreConfig = {
  rising: 1.25,
  falling: 0.8,
  dominanceStrong: 2.0,
  dominanceClear: 1.3,
  oneSidedFrac: 0.15,
  bigDelta: 1000,
  midDelta: 300,
  actionableGap: 2,
}

/** 2nd-half average over 1st-half average; halves split at floor(n/2). */
export function halvesRatio(values: number[]): number {
  if (values.length < 2) return 1
  const mid = Math.floor(values.length / 2)
  const avg = (xs: number[]) => xs.reduce((s, v) => s + v, 0) / xs.length
  const a = avg(values.slice(0, mid))
  const b = avg(values.slice(mid))
  return a === 0 ? (b > 0 ? 2 : 1) : b / a
}

const fmt = (x: number) => (Number.isInteger(x) ? String(x) : x.toFixed(2))

export function scoreSetup(input: ScoreInput, cfg: ScoreConfig = DEFAULT_SCORE_CONFIG): ScoreSnapshot {
  const cs = input.candles
  const n = cs.length
  const contributions: PriorityContribution[] = []
  let rj = 0
  let bk = 0
  const add = (id: PriorityContribution['id'], side: Side | null, points: number, reason: string, detail: string) => {
    if (side === 'RJ') rj += points
    if (side === 'BK') bk += points
    contributions.push({ id, side, points, reason, detail })
  }

  // P1 — trend vs attack (weight 3)
  const withTrend = input.attack === input.trend
  if (withTrend) {
    add('P1', 'BK', 3, 'attack runs with the trend', `attack ${input.attack}, trend ${input.trend} — with-trend attacks are the ones that break levels`)
  } else {
    add('P1', 'RJ', 3, 'attack fights the trend', `attack ${input.attack}, trend ${input.trend} — counter-trend attacks usually fail at the level`)
  }

  if (n === 0) {
    return snapshot(rj, bk, contributions, n, cfg)
  }

  // P2 — punch battle: magnitude x trend of each side's punch (weight 1-3 by dominance)
  const avgMax = cs.reduce((s, c) => s + c.max_delta, 0) / n
  const avgMin = cs.reduce((s, c) => s + Math.abs(c.min_delta), 0) / n
  const buyPower = avgMax * halvesRatio(cs.map((c) => c.max_delta))
  const sellPower = avgMin * halvesRatio(cs.map((c) => Math.abs(c.min_delta)))
  const buyersWin = buyPower > sellPower
  const domRatio = buyersWin ? buyPower / (sellPower || 1) : sellPower / (buyPower || 1)
  const p2pts = domRatio >= cfg.dominanceStrong ? 3 : domRatio >= cfg.dominanceClear ? 2 : 1
  // buyers winning defend support (RJ) but conquer resistance (BK); sellers mirrored
  const p2side: Side = buyersWin === (input.levelKind === 'support') ? 'RJ' : 'BK'
  add(
    'P2',
    p2side,
    p2pts,
    `${buyersWin ? 'buyers' : 'sellers'} winning the punch battle x${domRatio.toFixed(1)}`,
    `buy power ${fmt(buyPower)} vs sell power ${fmt(sellPower)} (avg punch x trend); ${buyersWin ? 'buyers' : 'sellers'} are the ${p2side === 'RJ' ? 'defenders — level holds' : 'attackers — level gives way'}`,
  )

  // P3 — one-sided attack candles, scaled by |delta| (weight 1-3)
  let p3 = 0
  let p3detail = ''
  for (const c of cs) {
    const M = c.max_delta
    const m = Math.abs(c.min_delta)
    const oneSided =
      input.attack === 'down'
        ? c.delta < 0 && (M === 0 || M < cfg.oneSidedFrac * m)
        : c.delta > 0 && (m === 0 || m < cfg.oneSidedFrac * M)
    if (oneSided) {
      const a = Math.abs(c.delta)
      const pts = a >= cfg.bigDelta ? 3 : a >= cfg.midDelta ? 2 : 1
      if (pts > p3) {
        p3 = pts
        p3detail = `candle delta ${fmt(c.delta)} with almost no opposing response (punch ${fmt(input.attack === 'down' ? M : m)})`
      }
    }
  }
  if (p3 > 0) {
    add('P3', 'BK', p3, 'one-sided aggression — defenders absent', p3detail)
  } else {
    add('P3', null, 0, 'no one-sided attack candles', 'every push met an opposing response')
  }

  // P4 — CVD divergence (weight 2)
  if (input.cvdDivergence) {
    add('P4', 'RJ', 2, 'CVD divergence at the level', 'flow is not confirming the attack — absorption in progress')
  } else {
    add('P4', null, 0, 'no CVD divergence', 'CVD is confirming price so far')
  }

  // P5 — rejection wicks in the last third (weight 2) / opposing wick dominance (weight 1)
  const rejZone = input.levelKind === 'support' ? 'below' : 'above'
  const oppZone = input.levelKind === 'support' ? 'above' : 'below'
  const lastThird = cs.slice(Math.floor((2 * n) / 3))
  const lateRej = lastThird.filter((c) => c.price_action === rejZone).length
  const rejAll = cs.filter((c) => c.price_action === rejZone).length
  const oppAll = cs.filter((c) => c.price_action === oppZone).length
  if (lateRej > 0) {
    add('P5', 'RJ', 2, `rejection wick${lateRej > 1 ? 's' : ''} printing at the level`, `${lateRej} ${rejZone}-wick(s) in the last third — the level is being defended`)
  } else if (oppAll > rejAll) {
    add('P5', 'BK', 1, 'wicks lean against the level', `${oppAll} opposing vs ${rejAll} rejection wicks — pullbacks get sold back into the move`)
  } else {
    add('P5', null, 0, 'no decisive wick pattern', `${rejAll} rejection vs ${oppAll} opposing wicks`)
  }

  // P6 — volume behavior (weight 1)
  if (cs.every((c) => c.volume != null)) {
    const v = halvesRatio(cs.map((c) => c.volume))
    if (v > cfg.rising) {
      add('P6', 'RJ', 1, 'volume rising into the level', `x${v.toFixed(2)} — defenders are showing up`)
    } else if (v < cfg.falling) {
      add('P6', 'BK', 1, 'volume drying up', `x${v.toFixed(2)} — the defense is not arriving`)
    } else {
      add('P6', null, 0, 'volume flat', `x${v.toFixed(2)}`)
    }
  }

  return snapshot(rj, bk, contributions, n, cfg)
}

function snapshot(
  rj: number,
  bk: number,
  contributions: PriorityContribution[],
  candleCount: number,
  cfg: ScoreConfig,
): ScoreSnapshot {
  const gap = Math.abs(rj - bk)
  return {
    ts: Date.now(),
    candleCount,
    rj,
    bk,
    gap,
    verdict: rj > bk ? 'REJECT' : bk > rj ? 'BREAK' : 'TIE',
    actionable: gap >= cfg.actionableGap && candleCount >= 3,
    provisional: candleCount < 4,
    contributions,
  }
}

/** Convenience for replaying dataset records. */
export function metricsFromRecordCandle(c: {
  time: string | null
  absorption: 'above' | 'below'
  price_action: 'above' | 'below' | null
  cvd_price_action: 'above' | 'below' | null
  volume: number | null
  delta: number | null
  max_delta: number | null
  min_delta: number | null
}): CandleMetrics {
  return {
    time: c.time,
    absorption: c.absorption,
    price_action: c.price_action,
    cvd_price_action: c.cvd_price_action,
    volume: c.volume ?? 0,
    delta: c.delta ?? 0,
    max_delta: c.max_delta ?? 0,
    min_delta: c.min_delta ?? 0,
  }
}
