import { useState } from 'react'
import { useMarketStore, useSessionStore, useDraftStore } from '../../state/stores'
import { arm, disarm, endSession } from '../../state/controller'
import type { Direction } from '../../core/types'
import { fmtNum } from '../format'

export default function SessionControls() {
  const phase = useSessionStore((s) => s.phase)
  const levelKind = useSessionStore((s) => s.levelKind)
  const zoneHigh = useSessionStore((s) => s.zoneHigh)
  const zoneLow = useSessionStore((s) => s.zoneLow)
  const trendArmed = useSessionStore((s) => s.trend)
  const lastPrice = useMarketStore((s) => s.lastPrice)
  const draftHigh = useDraftStore((s) => s.high)
  const draftLow = useDraftStore((s) => s.low)
  const setHigh = useDraftStore((s) => s.setHigh)
  const setLow = useDraftStore((s) => s.setLow)
  const clearDraft = useDraftStore((s) => s.clear)
  const [trend, setTrend] = useState<Direction>('up')
  const [isRetest, setIsRetest] = useState(false)

  if (phase === 'armed') {
    return (
      <div className="rounded-lg border border-amber-900/60 bg-amber-950/20 p-3 flex items-center gap-4 text-sm">
        <span className="text-amber-400 font-semibold">ARMED</span>
        <span className="text-neutral-300">
          {levelKind} zone <span className="font-mono">{fmtNum(zoneLow, 2)} – {fmtNum(zoneHigh, 2)}</span> · trend {trendArmed}
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

  if (phase === 'labeling') return null

  const a = Number(draftHigh)
  const b = Number(draftLow)
  const bothSet = draftHigh !== '' && draftLow !== ''
  const valid = bothSet && Number.isFinite(a) && Number.isFinite(b) && a > 0 && b > 0 && a !== b && lastPrice != null
  const zHigh = Math.max(a, b)
  const zLow = Math.min(a, b)
  const impliedKind =
    valid && lastPrice != null
      ? lastPrice >= zHigh
        ? 'support'
        : lastPrice <= zLow
          ? 'resistance'
          : lastPrice >= (zHigh + zLow) / 2
            ? 'support'
            : 'resistance'
      : null

  return (
    <div className="rounded-lg border border-neutral-800 p-3 flex flex-wrap items-center gap-3 text-sm">
      <span className="text-xs uppercase tracking-wider text-neutral-500">Arm key zone</span>
      <input
        value={draftHigh}
        onChange={(e) => setHigh(e.target.value)}
        placeholder="zone high"
        className="bg-neutral-900 border border-neutral-700 rounded px-2 py-1 w-32 font-mono text-neutral-200 focus:outline-none focus:border-sky-600"
      />
      <input
        value={draftLow}
        onChange={(e) => setLow(e.target.value)}
        placeholder="zone low"
        className="bg-neutral-900 border border-neutral-700 rounded px-2 py-1 w-32 font-mono text-neutral-200 focus:outline-none focus:border-sky-600"
      />
      <span className="text-neutral-600 text-xs">or click the chart twice (1st = high, 2nd = low)</span>
      {(draftHigh || draftLow) && (
        <button
          onClick={() => clearDraft()}
          className="px-2 py-1 rounded border border-neutral-800 text-neutral-500 hover:bg-neutral-800"
        >
          clear
        </button>
      )}
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
          → {impliedKind} zone {fmtNum(zLow, 2)}–{fmtNum(zHigh, 2)}
        </span>
      )}
      <button
        disabled={!valid}
        onClick={() => {
          if (valid && lastPrice != null) {
            arm({ zoneA: a, zoneB: b, currentPrice: lastPrice, trend, isRetest })
            clearDraft()
          }
        }}
        className="ml-auto px-4 py-1.5 rounded font-semibold border border-amber-700 text-amber-400 hover:bg-amber-950/40 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        Arm
      </button>
    </div>
  )
}
