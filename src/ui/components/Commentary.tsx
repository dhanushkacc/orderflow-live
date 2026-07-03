import { useEffect, useRef } from 'react'
import { useSessionStore } from '../../state/stores'
import { fmtClock } from '../format'

const KIND_STYLE: Record<string, string> = {
  candle: 'text-neutral-300',
  bias: 'text-amber-300 font-semibold',
  signal: 'text-sky-300',
  warning: 'text-orange-400',
}

export default function Commentary() {
  const events = useSessionStore((s) => s.events)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [events.length])

  return (
    <div className="rounded-lg border border-neutral-800 flex flex-col h-full min-h-0">
      <div className="text-xs uppercase tracking-wider text-neutral-500 px-3 pt-3 pb-2">Live commentary</div>
      <div className="flex-1 min-h-0 overflow-y-auto px-3 pb-3 space-y-1 text-[13px] font-mono">
        {events.length === 0 && <div className="text-neutral-600">Waiting for the first candle close…</div>}
        {events.map((e, i) => (
          <div key={i} className="flex gap-2">
            <span className="text-neutral-600 shrink-0">{fmtClock(e.ts)}</span>
            <span className={KIND_STYLE[e.kind] ?? 'text-neutral-300'}>{e.text}</span>
          </div>
        ))}
        <div ref={endRef} />
      </div>
    </div>
  )
}
