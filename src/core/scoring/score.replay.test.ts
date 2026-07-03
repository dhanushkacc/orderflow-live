/**
 * ACCEPTANCE GATE — replays the 16-record labelled dataset through the scoring
 * engine and asserts the exact documented backtest: 13 hits, misses #8 & #14,
 * tie #11, with the exact per-record RJ/BK totals. If this test fails, the
 * engine no longer implements the validated v3 model.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Dataset } from '../types'
import { scoreSetup, metricsFromRecordCandle } from './score'
import { scenarioGeometry } from './scenario'

const dataset = JSON.parse(
  readFileSync(join(__dirname, '..', '..', 'test', 'fixtures', 'dataset.json'), 'utf8'),
) as Dataset

const EXPECTED: Record<number, { rj: number; bk: number; verdict: 'REJECT' | 'BREAK' | 'TIE' }> = {
  1: { rj: 10, bk: 0, verdict: 'REJECT' },
  2: { rj: 6, bk: 3, verdict: 'REJECT' },
  3: { rj: 6, bk: 4, verdict: 'REJECT' },
  4: { rj: 7, bk: 3, verdict: 'REJECT' },
  5: { rj: 8, bk: 1, verdict: 'REJECT' },
  6: { rj: 4, bk: 8, verdict: 'BREAK' },
  7: { rj: 4, bk: 5, verdict: 'BREAK' },
  8: { rj: 3, bk: 4, verdict: 'BREAK' }, // known miss (high-volume grind)
  9: { rj: 9, bk: 0, verdict: 'REJECT' },
  10: { rj: 8, bk: 2, verdict: 'REJECT' },
  11: { rj: 4, bk: 4, verdict: 'TIE' },
  12: { rj: 8, bk: 0, verdict: 'REJECT' },
  13: { rj: 0, bk: 5, verdict: 'BREAK' },
  14: { rj: 7, bk: 3, verdict: 'REJECT' }, // known miss (retest-fail inversion)
  15: { rj: 3, bk: 7, verdict: 'BREAK' },
  16: { rj: 6, bk: 3, verdict: 'REJECT' },
}

describe('v3 scoring engine — dataset replay acceptance', () => {
  const results = dataset.records.map((rec) => {
    const geo = scenarioGeometry(rec.scenario)
    const snap = scoreSetup({
      levelKind: geo.levelKind,
      attack: geo.attack,
      trend: rec.trend,
      cvdDivergence: rec.cvd_divergence,
      candles: rec.candles.map(metricsFromRecordCandle),
    })
    return { rec, geo, snap }
  })

  it('reproduces the exact per-record RJ/BK totals and verdicts', () => {
    for (const { rec, snap } of results) {
      const exp = EXPECTED[rec.record_id]
      expect({ id: rec.record_id, rj: snap.rj, bk: snap.bk, verdict: snap.verdict }).toEqual({
        id: rec.record_id,
        rj: exp.rj,
        bk: exp.bk,
        verdict: exp.verdict,
      })
    }
  })

  it('scores 13 hits, 2 misses (#8, #14), 1 tie (#11)', () => {
    let hits = 0
    const misses: number[] = []
    const ties: number[] = []
    for (const { rec, geo, snap } of results) {
      if (snap.verdict === 'TIE') ties.push(rec.record_id)
      else if (snap.verdict === geo.outcome) hits++
      else misses.push(rec.record_id)
    }
    expect(hits).toBe(13)
    expect(misses).toEqual([8, 14])
    expect(ties).toEqual([11])
  })

  it('every evaluation reports all six priorities', () => {
    for (const { snap } of results) {
      expect(snap.contributions.map((c) => c.id)).toEqual(['P1', 'P2', 'P3', 'P4', 'P5', 'P6'])
    }
  })
})
