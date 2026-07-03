import { useState } from 'react'
import { useMarketStore } from '../../state/stores'
import { startMarket, setTimeframe } from '../../state/controller'
import type { Timeframe } from '../../core/types'
import { fmtNum } from '../format'

const STATUS_DOT: Record<string, string> = {
  open: 'bg-green-500',
  connecting: 'bg-amber-500',
  reconnecting: 'bg-amber-500 animate-pulse',
  closed: 'bg-neutral-600',
}

const SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'PAXGUSDT']

export default function TopBar() {
  const symbol = useMarketStore((s) => s.symbol)
  const timeframe = useMarketStore((s) => s.timeframe)
  const status = useMarketStore((s) => s.status)
  const statusDetail = useMarketStore((s) => s.statusDetail)
  const lastPrice = useMarketStore((s) => s.lastPrice)
  const setSymbol = useMarketStore((s) => s.setSymbol)
  const [custom, setCustom] = useState('')

  const changeSymbol = (s: string) => {
    setSymbol(s.toUpperCase())
    void startMarket()
  }

  return (
    <div className="flex items-center gap-4 px-4 py-2 border-b border-neutral-800">
      <span className="font-semibold text-neutral-100">orderflow-live</span>

      <select
        value={SYMBOLS.includes(symbol) ? symbol : ''}
        onChange={(e) => e.target.value && changeSymbol(e.target.value)}
        className="bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-sm text-neutral-200"
      >
        {!SYMBOLS.includes(symbol) && <option value="">{symbol}</option>}
        {SYMBOLS.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (custom.trim()) {
            changeSymbol(custom.trim())
            setCustom('')
          }
        }}
      >
        <input
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          placeholder="other pair…"
          className="bg-neutral-900 border border-neutral-700 rounded px-2 py-1 w-28 text-sm text-neutral-200 focus:outline-none focus:border-sky-600"
        />
      </form>

      <div className="flex items-center gap-1">
        {(['1m', '3m', '5m'] as Timeframe[]).map((tf) => (
          <button
            key={tf}
            onClick={() => setTimeframe(tf)}
            className={`px-2 py-1 rounded text-sm border ${
              timeframe === tf
                ? 'border-sky-600 text-sky-400'
                : 'border-neutral-800 text-neutral-400 hover:bg-neutral-800'
            }`}
          >
            {tf}
          </button>
        ))}
      </div>

      <div className="ml-auto flex items-center gap-4">
        {lastPrice != null && (
          <span className="font-mono text-lg text-neutral-100">{fmtNum(lastPrice, 2)}</span>
        )}
        <span className="flex items-center gap-1.5 text-xs text-neutral-400">
          <span className={`w-2 h-2 rounded-full ${STATUS_DOT[status] ?? 'bg-neutral-600'}`} />
          {status}
          {statusDetail && <span className="text-neutral-600">({statusDetail})</span>}
        </span>
      </div>
    </div>
  )
}
