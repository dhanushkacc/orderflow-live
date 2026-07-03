import { useMarketStore, useSessionStore } from '../../state/stores'
import { fmtNum, fmtSigned } from '../format'

const VERDICT_LABEL: Record<string, { text: string; cls: string }> = {
  buyers_aggressive: { text: 'aggressive buyers dominating', cls: 'text-green-400' },
  sellers_aggressive: { text: 'aggressive sellers dominating', cls: 'text-red-400' },
  balanced: { text: 'aggression balanced', cls: 'text-neutral-400' },
}

const PASSIVE_LABEL: Record<string, { text: string; cls: string }> = {
  bids_stacked: { text: 'passive bids stacked', cls: 'text-green-400' },
  asks_stacked: { text: 'passive asks stacked', cls: 'text-red-400' },
  balanced: { text: 'book balanced', cls: 'text-neutral-400' },
}

export default function DominancePanel() {
  const dominance = useMarketStore((s) => s.dominance)
  const zoneHigh = useSessionStore((s) => s.zoneHigh)
  const zoneLow = useSessionStore((s) => s.zoneLow)

  if (!dominance) {
    return (
      <div className="rounded-lg border border-neutral-800 p-4 text-neutral-600 text-sm">
        Waiting for tape + order book…
      </div>
    )
  }

  const v = VERDICT_LABEL[dominance.verdict]
  const p = PASSIVE_LABEL[dominance.passiveSupport]
  const total = dominance.aggrBuyVol + dominance.aggrSellVol
  const buyPct = total === 0 ? 50 : (dominance.aggrBuyVol / total) * 100

  return (
    <div className="rounded-lg border border-neutral-800 p-4 space-y-2.5">
      <div className="text-xs uppercase tracking-wider text-neutral-500">Participants (60s)</div>

      <div className={`text-sm font-semibold ${v.cls}`}>{v.text}</div>

      <div className="relative h-3 rounded-full overflow-hidden bg-neutral-900">
        <div className="absolute inset-y-0 left-0 bg-green-600/70" style={{ width: `${buyPct}%` }} />
        <div className="absolute inset-y-0 right-0 bg-red-600/70" style={{ width: `${100 - buyPct}%` }} />
      </div>
      <div className="flex justify-between text-[11px] font-mono text-neutral-400">
        <span>mkt buys {fmtNum(dominance.aggrBuyVol, 1)}</span>
        <span>Δ {fmtSigned(dominance.aggrDelta, 1)}</span>
        <span>mkt sells {fmtNum(dominance.aggrSellVol, 1)}</span>
      </div>

      <div className={`text-xs ${p.cls}`}>
        {p.text} · imbalance {fmtSigned(dominance.bookImbalance * 100, 0)}%
      </div>

      {dominance.walls.length > 0 && (
        <div>
          <div className="text-[11px] text-neutral-500 mb-1">limit walls</div>
          <div className="space-y-0.5">
            {dominance.walls.map((w, i) => (
              <div key={i} className="flex items-center gap-2 text-[11px] font-mono">
                <span className={w.side === 'bid' ? 'text-green-400' : 'text-red-400'}>
                  {w.side}
                </span>
                <span className="text-neutral-300">{fmtNum(w.price, 2)}</span>
                <span className="text-neutral-500">qty {fmtNum(w.qty, 1)}</span>
                <span className="text-neutral-600">x{w.strength.toFixed(1)}</span>
                {zoneHigh != null && zoneLow != null && (
                  <span className="text-neutral-600 ml-auto">
                    {w.price > zoneHigh
                      ? `${fmtSigned(w.price - zoneHigh, 1)} above zone`
                      : w.price < zoneLow
                        ? `${fmtSigned(w.price - zoneLow, 1)} below zone`
                        : 'inside zone'}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
