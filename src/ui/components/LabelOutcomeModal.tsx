import { useState } from 'react'
import { useSessionStore, useRecordsStore } from '../../state/stores'
import { activeSession, disarm } from '../../state/controller'
import { buildRecord, impliedDirection } from '../../core/session/record'
import { appendRecord, nextRecordId } from '../../storage/dataset'
import type { CandleMetrics, Direction, Outcome, Zone } from '../../core/types'
import { fmtNum, fmtSigned } from '../format'

const ZONES: Array<Zone> = ['above', 'below', null]
const zoneLabel = (z: Zone) => (z === null ? 'none' : z)

export default function LabelOutcomeModal() {
  const phase = useSessionStore((s) => s.phase)
  if (phase !== 'labeling') return null
  return <ModalBody />
}

function ModalBody() {
  const session = activeSession()
  const levelKind = useSessionStore((s) => s.levelKind) ?? 'support'
  const trendArmed = useSessionStore((s) => s.trend) ?? 'up'
  const cvdSeen = useSessionStore((s) => s.cvdDivergence)
  const setCount = useRecordsStore((s) => s.setCount)

  const [outcome, setOutcome] = useState<Outcome | null>(null)
  const [retest, setRetest] = useState<boolean>(useSessionStore.getState().isRetest)
  const [trend, setTrend] = useState<Direction>(trendArmed)
  const [cvdDiv, setCvdDiv] = useState<boolean>(cvdSeen)
  const [metrics, setMetrics] = useState<CandleMetrics[]>(() => session?.candleMetrics.map((m) => ({ ...m })) ?? [])

  if (!session) {
    disarm()
    return null
  }

  const patchCandle = (i: number, patch: Partial<CandleMetrics>) => {
    setMetrics((ms) => ms.map((m, k) => (k === i ? { ...m, ...patch } : m)))
  }

  const saveRecord = () => {
    if (!outcome) return
    const record = buildRecord({
      recordId: nextRecordId(),
      levelKind,
      outcome,
      retest,
      trend,
      cvdDivergence: cvdDiv,
      metrics,
    })
    const ds = appendRecord(record)
    setCount(ds.records.length)
    disarm()
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
      <div className="bg-neutral-950 border border-neutral-700 rounded-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto p-5 space-y-4">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-semibold text-neutral-100">Label the outcome</h2>
          <span className="text-xs text-neutral-500">
            {metrics.length} candle{metrics.length === 1 ? '' : 's'} · {levelKind} zone {fmtNum(session.zoneLow, 2)}–{fmtNum(session.zoneHigh, 2)}
          </span>
        </div>

        <div className="space-y-3">
          <div>
            <div className="text-xs text-neutral-500 mb-1.5">what actually happened at the {levelKind} zone?</div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setOutcome('reject')}
                className={`py-3 rounded-lg border text-lg font-semibold ${
                  outcome === 'reject'
                    ? 'border-green-600 bg-green-950/40 text-green-400'
                    : 'border-neutral-700 text-neutral-400 hover:bg-neutral-900'
                }`}
              >
                REJECT — level held
              </button>
              <button
                onClick={() => setOutcome('break')}
                className={`py-3 rounded-lg border text-lg font-semibold ${
                  outcome === 'break'
                    ? 'border-red-600 bg-red-950/40 text-red-400'
                    : 'border-neutral-700 text-neutral-400 hover:bg-neutral-900'
                }`}
              >
                BREAK — level failed
              </button>
            </div>
            {outcome && (
              <div className="text-xs text-neutral-500 mt-1.5">
                → winning move: <span className="text-neutral-300 font-mono">{impliedDirection(levelKind, outcome)}</span>
              </div>
            )}
          </div>
          <div className="grid grid-cols-3 gap-3 text-sm">
            <label className="space-y-1">
              <span className="text-xs text-neutral-500">trend</span>
              <select
                value={trend}
                onChange={(e) => setTrend(e.target.value as Direction)}
                className="w-full bg-neutral-900 border border-neutral-700 rounded px-2 py-1.5 text-neutral-200"
              >
                <option value="up">up</option>
                <option value="down">down</option>
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-xs text-neutral-500">retest of a broken level?</span>
              <select
                value={String(retest)}
                onChange={(e) => setRetest(e.target.value === 'true')}
                className="w-full bg-neutral-900 border border-neutral-700 rounded px-2 py-1.5 text-neutral-200"
              >
                <option value="false">no — first touch</option>
                <option value="true">yes — retest</option>
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-xs text-neutral-500">CVD divergence (auto: {String(cvdSeen)})</span>
              <select
                value={String(cvdDiv)}
                onChange={(e) => setCvdDiv(e.target.value === 'true')}
                className="w-full bg-neutral-900 border border-neutral-700 rounded px-2 py-1.5 text-neutral-200"
              >
                <option value="true">true</option>
                <option value="false">false</option>
              </select>
            </label>
          </div>
        </div>

        <div>
          <div className="text-xs text-neutral-500 mb-1">candles — computed labels, correct anything the engine misread</div>
          <table className="w-full text-xs font-mono">
            <thead>
              <tr className="text-neutral-500 border-b border-neutral-800">
                <th className="py-1 text-left">#</th>
                <th className="text-left">absorb</th>
                <th className="text-left">PA</th>
                <th className="text-left">cvd PA</th>
                <th className="text-right">vol</th>
                <th className="text-right">Δ</th>
                <th className="text-right">maxΔ</th>
                <th className="text-right">minΔ</th>
              </tr>
            </thead>
            <tbody>
              {metrics.map((m, i) => (
                <tr key={i} className="border-b border-neutral-900">
                  <td className="py-1 text-neutral-500">{i + 1}</td>
                  <td>
                    <select
                      value={m.absorption}
                      onChange={(e) => patchCandle(i, { absorption: e.target.value as 'above' | 'below' })}
                      className="bg-neutral-900 border border-neutral-800 rounded px-1 py-0.5"
                    >
                      <option value="above">above</option>
                      <option value="below">below</option>
                    </select>
                  </td>
                  {(['price_action', 'cvd_price_action'] as const).map((field) => (
                    <td key={field}>
                      <select
                        value={zoneLabel(m[field])}
                        onChange={(e) =>
                          patchCandle(i, { [field]: e.target.value === 'none' ? null : (e.target.value as Zone) })
                        }
                        className="bg-neutral-900 border border-neutral-800 rounded px-1 py-0.5"
                      >
                        {ZONES.map((z) => (
                          <option key={zoneLabel(z)} value={zoneLabel(z)}>
                            {zoneLabel(z)}
                          </option>
                        ))}
                      </select>
                    </td>
                  ))}
                  <td className="text-right text-neutral-300">{fmtNum(m.volume, 1)}</td>
                  <td className={`text-right ${(m.delta ?? 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>{fmtSigned(m.delta, 1)}</td>
                  <td className="text-right text-green-500/80">{fmtNum(m.max_delta, 1)}</td>
                  <td className="text-right text-red-500/80">{fmtNum(m.min_delta, 1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <button
            onClick={() => disarm()}
            className="px-4 py-1.5 rounded border border-neutral-700 text-neutral-400 hover:bg-neutral-800"
          >
            Discard
          </button>
          <button
            disabled={metrics.length === 0 || outcome === null}
            onClick={saveRecord}
            className="px-4 py-1.5 rounded font-semibold border border-green-700 text-green-400 hover:bg-green-950/40 disabled:opacity-40"
          >
            Save record #{nextRecordId()}
          </button>
        </div>
      </div>
    </div>
  )
}
