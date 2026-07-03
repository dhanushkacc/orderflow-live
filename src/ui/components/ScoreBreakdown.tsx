import { useSessionStore } from '../../state/stores'

const LABELS: Record<string, string> = {
  P1: 'Trend vs attack',
  P2: 'Punch battle',
  P3: 'One-sided flow',
  P4: 'CVD divergence',
  P5: 'Wick pattern',
  P6: 'Volume behavior',
}

export default function ScoreBreakdown() {
  const snapshot = useSessionStore((s) => s.snapshot)
  if (!snapshot) return null

  return (
    <div className="rounded-lg border border-neutral-800 p-4">
      <div className="text-xs uppercase tracking-wider text-neutral-500 mb-2">Score breakdown</div>
      <div className="space-y-1.5">
        {snapshot.contributions.map((c) => (
          <div key={c.id} className="flex items-center gap-2 text-sm" title={c.detail}>
            <span className="w-7 text-neutral-500 font-mono text-xs">{c.id}</span>
            <span
              className={`w-14 text-center rounded px-1 py-0.5 text-xs font-mono font-semibold ${
                c.side === 'RJ'
                  ? 'bg-green-950 text-green-400'
                  : c.side === 'BK'
                    ? 'bg-red-950 text-red-400'
                    : 'bg-neutral-900 text-neutral-600'
              }`}
            >
              {c.side ? `${c.side} +${c.points}` : '—'}
            </span>
            <span className="text-neutral-300 flex-1 truncate" title={`${c.reason} — ${c.detail}`}>
              {LABELS[c.id]}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-3 text-[11px] text-neutral-500 leading-relaxed">
        {snapshot.contributions
          .filter((c) => c.side)
          .map((c) => (
            <div key={c.id}>
              <span className="font-mono">{c.id}</span> {c.reason}
            </div>
          ))}
      </div>
    </div>
  )
}
