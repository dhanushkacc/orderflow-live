import { useState } from 'react'
import { useMarketStore, useSessionStore, useDraftStore } from '../../state/stores'
import { arm, disarm, endSession } from '../../state/controller'
import type { Direction } from '../../core/types'
import { fmtNum } from '../format'

export default function SessionControls() {
  const phase = useSessionStore((s) => s.phase)
  const levelKind = useSessionStore((s) => s.levelKind)
  const level = useSessionStore((s) => s.level)
  const trendArmed = useSessionStore((s) => s.trend)
  const lastPrice = useMarketStore((s) => s.lastPrice)
  const draftLevel = useDraftStore((s) => s.level)
  const setDraftLevel = useDraftStore((s) => s.setLevel)
  const [trend, setTrend] = useState<Direction>('up')
  const [isRetest, setIsRetest] = useState(false)

  if (phase === 'armed') {
    return (
      <div className="rounded-lg border border-amber-900/60 bg-amber-950/20 p-3 flex items-center gap-4 text-sm">
        <span className="text-amber-400 font-semibold">ARMED</span>
        <span className="text-neutral-300">
          {levelKind} @ <span className="font-mono">{fmtNum(level, 2)}</span> · trend {trendArmed}
        </span>
        <button
          onClick={() => endSession()}
          className="ml-auto px-3 py-1 rounded font-semibold border border-green-700 text-green-400 hover:bg-green-950/40"
        >
          End &amp; label
        </button>
        <button
          onClick={() => disarm()}
          className="px-3 py-1 rounded border border-neutral-700 text-neutral-300 hover:bg-neutral-800"
        >
          Discard
        </button>
      </div>
    )
  }

  const parsed = Number(draftLevel)
  const valid = draftLevel !== '' && Number.isFinite(parsed) && parsed > 0 && lastPrice != null
  const impliedKind = valid && lastPrice != null ? (lastPrice >= parsed ? 'support' : 'resistance') : null

  return (
    <div className="rounded-lg border border-neutral-800 p-3 flex flex-wrap items-center gap-3 text-sm">
      <span className="text-xs uppercase tracking-wider text-neutral-500">Arm key level</span>
      <input
        value={draftLevel}
        onChange={(e) => setDraftLevel(e.target.value)}
        placeholder="level price (or click chart)"
        className="bg-neutral-900 border border-neutral-700 rounded px-2 py-1 w-44 font-mono text-neutral-200 focus:outline-none focus:border-sky-600"
      />
      <button
        onClick={() => lastPrice != null && setDraftLevel(lastPrice.toFixed(2))}
        className="px-2 py-1 rounded border border-neutral-700 text-neutral-400 hover:bg-neutral-800"
      >
        use last price
      </button>
      <div className="flex items-center gap-1">
        <span className="text-neutral-500">trend</span>
        {(['up', 'down'] as Direction[]).map((d) => (
          <button
            key={d}
            onClick={() => setTrend(d)}
            className={`px-2 py-1 rounded border ${
              trend === d ? 'border-sky-600 text-sky-400' : 'border-neutral-700 text-neutral-400 hover:bg-neutral-800'
            }`}
          >
            {d}
          </button>
        ))}
      </div>
      <label className="flex items-center gap-1.5 text-neutral-400 cursor-pointer">
        <input type="checkbox" checked={isRetest} onChange={(e) => setIsRetest(e.target.checked)} />
        retest
      </label>
      {impliedKind && (
        <span className="text-neutral-500 text-xs">
          → {impliedKind} (price {fmtNum(lastPrice, 2)} is {impliedKind === 'support' ? 'above' : 'below'})
        </span>
      )}
      <button
        disabled={!valid}
        onClick={() => valid && lastPrice != null && arm({ level: parsed, currentPrice: lastPrice, trend, isRetest })}
        className="ml-auto px-4 py-1.5 rounded font-semibold border border-amber-700 text-amber-400 hover:bg-amber-950/40 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        Arm
      </button>
    </div>
  )
}
