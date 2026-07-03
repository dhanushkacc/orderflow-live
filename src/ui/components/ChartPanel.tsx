import { useEffect, useMemo, useRef } from 'react'
import {
  createChart,
  CandlestickSeries,
  LineSeries,
  LineStyle,
  type IChartApi,
  type IPriceLine,
  type ISeriesApi,
  type UTCTimestamp,
} from 'lightweight-charts'
import { useMarketStore, useSessionStore, useDraftStore } from '../../state/stores'
import { aggregateSeries } from '../../core/candles/aggregate'
import { TIMEFRAME_MS } from '../../core/types'
import { fmtNum, fmtSigned } from '../format'

interface Bar {
  time: UTCTimestamp
  open: number
  high: number
  low: number
  close: number
}

export default function ChartPanel() {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null)
  const cvdSeriesRef = useRef<ISeriesApi<'Line'> | null>(null)
  const levelLineRef = useRef<IPriceLine | null>(null)

  const warmup = useMarketStore((s) => s.warmup)
  const candles1m = useMarketStore((s) => s.candles1m)
  const forming = useMarketStore((s) => s.forming)
  const timeframe = useMarketStore((s) => s.timeframe)
  const level = useSessionStore((s) => s.level)
  const phase = useSessionStore((s) => s.phase)

  const tfMs = TIMEFRAME_MS[timeframe]
  const liveTf = useMemo(() => {
    const closed = tfMs === 60_000 ? candles1m : aggregateSeries(candles1m, tfMs)
    if (!forming) return closed
    if (tfMs === 60_000) return [...closed, forming]
    const bucket = Math.floor(forming.ts / tfMs) * tfMs
    const inBucket = candles1m.filter((c) => Math.floor(c.ts / tfMs) * tfMs === bucket)
    const partial = aggregateSeries([...inBucket, forming], tfMs).at(-1)
    return partial ? [...closed.filter((c) => c.ts !== bucket), partial] : closed
  }, [candles1m, forming, tfMs])

  useEffect(() => {
    if (!containerRef.current) return
    const chart = createChart(containerRef.current, {
      autoSize: true,
      layout: { background: { color: 'transparent' }, textColor: '#a3a3a3', attributionLogo: false },
      grid: { vertLines: { color: '#1f1f1f' }, horzLines: { color: '#1f1f1f' } },
      timeScale: { timeVisible: true, secondsVisible: false, borderColor: '#333' },
      rightPriceScale: { borderColor: '#333' },
      crosshair: { mode: 0 },
    })
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#16a34a',
      downColor: '#dc2626',
      wickUpColor: '#16a34a',
      wickDownColor: '#dc2626',
      borderVisible: false,
    })
    const cvdSeries = chart.addSeries(LineSeries, { color: '#38bdf8', lineWidth: 2, priceLineVisible: false }, 1)
    chart.panes()[1]?.setHeight(90)

    chart.subscribeClick((param) => {
      if (!param.point) return
      const price = candleSeries.coordinateToPrice(param.point.y)
      if (price != null) useDraftStore.getState().setLevel(price.toFixed(2))
    })

    chartRef.current = chart
    candleSeriesRef.current = candleSeries
    cvdSeriesRef.current = cvdSeries
    return () => {
      chart.remove()
      chartRef.current = null
      candleSeriesRef.current = null
      cvdSeriesRef.current = null
      levelLineRef.current = null
    }
  }, [])

  useEffect(() => {
    const series = candleSeriesRef.current
    const cvd = cvdSeriesRef.current
    if (!series || !cvd) return
    const byTime = new Map<number, Bar>()
    for (const k of warmup) {
      byTime.set(k.openTime, {
        time: (k.openTime / 1000) as UTCTimestamp,
        open: k.open,
        high: k.high,
        low: k.low,
        close: k.close,
      })
    }
    for (const c of liveTf) {
      byTime.set(c.ts, {
        time: (c.ts / 1000) as UTCTimestamp,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      })
    }
    series.setData([...byTime.values()].sort((a, b) => (a.time as number) - (b.time as number)))
    cvd.setData(
      liveTf.map((c) => ({ time: (c.ts / 1000) as UTCTimestamp, value: c.cvdClose })),
    )
  }, [warmup, liveTf])

  useEffect(() => {
    const series = candleSeriesRef.current
    if (!series) return
    if (levelLineRef.current) {
      series.removePriceLine(levelLineRef.current)
      levelLineRef.current = null
    }
    if (level != null) {
      levelLineRef.current = series.createPriceLine({
        price: level,
        color: '#eab308',
        lineWidth: 2,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: 'key level',
      })
    }
  }, [level, phase])

  const strip = liveTf.slice(-9)

  return (
    <div className="flex flex-col h-full min-h-0">
      <div ref={containerRef} className="flex-1 min-h-0" />
      <div className="border-t border-neutral-800 overflow-x-auto">
        <table className="text-[11px] font-mono w-full">
          <tbody>
            <MetricRow label="vol" values={strip.map((c) => fmtNum(c.volume, 1))} tones={strip.map(() => 'text-neutral-300')} />
            <MetricRow label="Δ" values={strip.map((c) => fmtSigned(c.delta, 1))} tones={strip.map((c) => (c.delta >= 0 ? 'text-green-400' : 'text-red-400'))} />
            <MetricRow label="maxΔ" values={strip.map((c) => fmtNum(c.maxDelta, 1))} tones={strip.map(() => 'text-green-500/80')} />
            <MetricRow label="minΔ" values={strip.map((c) => fmtNum(c.minDelta, 1))} tones={strip.map(() => 'text-red-500/80')} />
          </tbody>
        </table>
      </div>
    </div>
  )
}

function MetricRow({ label, values, tones }: { label: string; values: string[]; tones: string[] }) {
  return (
    <tr className="border-b border-neutral-900 last:border-0">
      <td className="px-2 py-0.5 text-neutral-500 w-12">{label}</td>
      {values.map((v, i) => (
        <td key={i} className={`px-2 py-0.5 text-right ${tones[i]}`}>
          {v}
        </td>
      ))}
    </tr>
  )
}
