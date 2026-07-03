/**
 * Turns score snapshots and candle closes into the plain-language timeline
 * shown in the UI ("candle 3: sellers punched -450, absorbed below", "bias
 * flipped — gap 3"). Pure functions: (prev, next, candle) -> events.
 */
import type { CandleMetrics, ScoreSnapshot } from '../types'

export interface CommentaryEvent {
  ts: number
  kind: 'candle' | 'bias' | 'signal' | 'warning'
  text: string
}

const fmt = (x: number) => {
  const r = Math.round(x)
  return r > 0 ? `+${r}` : String(r)
}

/** One-line story of a freshly closed candle. */
export function describeCandle(index: number, c: CandleMetrics): CommentaryEvent {
  const seller = Math.abs(c.min_delta)
  const buyer = c.max_delta
  const punchSide = c.delta < 0 ? 'sellers' : 'buyers'
  const parts: string[] = [`candle ${index}: ${punchSide} punched ${fmt(c.delta)}`]
  parts.push(`volume absorbed ${c.absorption} (buy punch ${fmt(buyer)} / sell punch ${fmt(-seller)})`)
  if (c.price_action) parts.push(`wick rejecting ${c.price_action}`)
  return { ts: Date.now(), kind: 'candle', text: parts.join(', ') }
}

/** Events derived from the difference between two score snapshots. */
export function describeScoreChange(prev: ScoreSnapshot | null, next: ScoreSnapshot): CommentaryEvent[] {
  const events: CommentaryEvent[] = []
  const now = Date.now()

  if (prev && prev.verdict !== next.verdict) {
    events.push({
      ts: now,
      kind: 'bias',
      text:
        next.verdict === 'TIE'
          ? `bias neutralized — reject ${next.rj} vs break ${next.bk}`
          : `bias flipped to ${next.verdict} — reject ${next.rj} vs break ${next.bk} (gap ${next.gap})`,
    })
  }

  if (next.actionable && (!prev || !prev.actionable)) {
    events.push({
      ts: now,
      kind: 'signal',
      text: `signal actionable: ${next.verdict} with gap ${next.gap}`,
    })
  }
  if (prev?.actionable && !next.actionable) {
    events.push({ ts: now, kind: 'warning', text: `signal weakened — gap down to ${next.gap}` })
  }

  // priority-level changes worth narrating
  if (prev) {
    for (const c of next.contributions) {
      const before = prev.contributions.find((p) => p.id === c.id)
      if (!before) continue
      if (c.side !== before.side || c.points !== before.points) {
        if (c.side) {
          events.push({ ts: now, kind: 'signal', text: `${c.id} now ${c.side} +${c.points}: ${c.reason}` })
        } else if (before.side) {
          events.push({ ts: now, kind: 'signal', text: `${c.id} dropped (was ${before.side} +${before.points})` })
        }
      }
    }
  }

  return events
}
