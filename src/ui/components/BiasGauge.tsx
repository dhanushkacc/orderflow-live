import { useSessionStore } from '../../state/stores'

export default function BiasGauge() {
  const snapshot = useSessionStore((s) => s.snapshot)
  const phase = useSessionStore((s) => s.phase)
  const isRetest = useSessionStore((s) => s.isRetest)

  if (phase !== 'armed') {
    return (
      <div className="rounded-lg border border-neutral-800 p-4 text-center text-neutral-500 text-sm">
        Arm a key level to start the bias gauge
      </div>
    )
  }

  const rj = snapshot?.rj ?? 0
  const bk = snapshot?.bk ?? 0
  const total = rj + bk
  const rjPct = total === 0 ? 50 : (rj / total) * 100
  const verdict = snapshot?.verdict ?? 'TIE'
  const actionable = snapshot?.actionable ?? false

  const verdictColor =
    verdict === 'REJECT' ? 'text-green-400' : verdict === 'BREAK' ? 'text-red-400' : 'text-neutral-400'

  return (
    <div className="rounded-lg border border-neutral-800 p-4 space-y-3">
      <div className="flex items-baseline justify-between">
        <span className="text-xs uppercase tracking-wider text-neutral-500">Bias</span>
        {snapshot && (
          <span className="text-xs text-neutral-500">
            {snapshot.candleCount} candle{snapshot.candleCount === 1 ? '' : 's'}
            {snapshot.provisional ? ' · provisional' : ''}
          </span>
        )}
      </div>

      <div className={`text-center text-3xl font-semibold ${verdictColor}`}>
        {verdict === 'TIE' ? 'NO EDGE' : verdict}
      </div>

      <div className="relative h-6 rounded-full overflow-hidden bg-neutral-900 border border-neutral-800">
        <div className="absolute inset-y-0 left-0 bg-green-600/70 transition-all duration-500" style={{ width: `${rjPct}%` }} />
        <div className="absolute inset-y-0 right-0 bg-red-600/70 transition-all duration-500" style={{ width: `${100 - rjPct}%` }} />
        <div className="absolute inset-0 flex items-center justify-between px-2 text-[11px] font-mono font-semibold">
          <span className="text-white drop-shadow">REJECT {rj}</span>
          <span className="text-white drop-shadow">{bk} BREAK</span>
        </div>
      </div>

      <div className="flex items-center justify-center gap-2 text-xs">
        <span
          className={`px-2 py-0.5 rounded-full border ${
            actionable
              ? 'border-amber-500 text-amber-400 font-semibold'
              : 'border-neutral-700 text-neutral-500'
          }`}
        >
          {actionable ? `ACTIONABLE · gap ${snapshot!.gap}` : `gap ${snapshot?.gap ?? 0} — waiting`}
        </span>
        {isRetest && (
          <span className="px-2 py-0.5 rounded-full border border-orange-700 text-orange-400">retest · reduced confidence</span>
        )}
      </div>
    </div>
  )
}
