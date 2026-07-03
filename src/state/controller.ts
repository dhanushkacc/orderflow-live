/**
 * Wires the Binance feed into the candle builder, divergence detector and the
 * active analysis session, publishing throttled updates into the zustand stores.
 * Framework-free except for the stores.
 */
import { BinanceFeed } from '../feed/binanceWs'
import { fetchKlines } from '../feed/binanceRest'
import { CandleBuilder } from '../core/candles/builder'
import { aggregateSeries } from '../core/candles/aggregate'
import { CvdDivergenceDetector } from '../core/metrics/cvd'
import { AnalysisSession, type ArmParams } from '../core/session/session'
import { DominanceTracker, AbsorptionDetector } from '../core/depth/depthMetrics'
import { TIMEFRAME_MS, type FootprintCandle, type Timeframe } from '../core/types'
import { useMarketStore, useSessionStore, MAX_1M_HISTORY } from './stores'

const PRICE_BINS: Record<string, number> = {
  BTCUSDT: 10,
  ETHUSDT: 1,
}
const DEFAULT_PRICE_BIN = 10

let feed: BinanceFeed | null = null
let builder: CandleBuilder | null = null
let detector: CvdDivergenceDetector | null = null
let session: AnalysisSession | null = null
let dominance: DominanceTracker | null = null
let absorption: AbsorptionDetector | null = null
/** 1m candles buffered toward the current TF bucket for session aggregation */
let tfBuffer: FootprintCandle[] = []
let lastFormingPush = 0
let lastDominancePush = 0

export function priceBinFor(symbol: string): number {
  return PRICE_BINS[symbol.toUpperCase()] ?? DEFAULT_PRICE_BIN
}

export async function startMarket(): Promise<void> {
  stopMarket()
  const { symbol, timeframe } = useMarketStore.getState()
  builder = new CandleBuilder({ barMs: 60_000, priceBin: priceBinFor(symbol) })
  detector = new CvdDivergenceDetector(10)
  dominance = new DominanceTracker(60_000)
  absorption = new AbsorptionDetector()
  tfBuffer = []

  try {
    const warmup = await fetchKlines(symbol, timeframe, 300)
    useMarketStore.setState({ warmup })
  } catch {
    useMarketStore.setState({ warmup: [] })
  }

  feed = new BinanceFeed(symbol, {
    onTrade: (t) => {
      if (!builder) return
      const closed = builder.push(t)
      if (closed) onBaseCandleClosed(closed)
      dominance?.pushTrade(t)
      const depthNow = useMarketStore.getState().depth
      const absEvent = absorption?.push(t, depthNow)
      if (absEvent && session) {
        const prev = useSessionStore.getState()
        useSessionStore.setState({
          events: [...prev.events, { ts: absEvent.ts, kind: 'signal' as const, text: absEvent.text }].slice(-200),
        })
      }
      const now = Date.now()
      if (now - lastFormingPush > 250) {
        lastFormingPush = now
        useMarketStore.setState({ forming: builder.current(), lastPrice: t.price })
      }
      if (now - lastDominancePush > 1000 && dominance) {
        lastDominancePush = now
        useMarketStore.setState({ dominance: dominance.compute(depthNow) })
      }
    },
    onDepth: (d) => {
      useMarketStore.setState({ depth: d })
    },
    onStatus: (status, detail) => {
      useMarketStore.setState({ status, statusDetail: detail ?? '' })
    },
  })
  feed.start()
}

export function stopMarket(): void {
  feed?.stop()
  feed = null
  builder = null
  detector = null
  disarm()
  useMarketStore.setState({ candles1m: [], forming: null, warmup: [], depth: null })
}

function onBaseCandleClosed(candle: FootprintCandle): void {
  const st = useMarketStore.getState()
  const candles1m = [...st.candles1m, candle].slice(-MAX_1M_HISTORY)
  useMarketStore.setState({ candles1m })

  const tfMs = TIMEFRAME_MS[st.timeframe]
  if (tfMs === 60_000) {
    onTfCandleClosed(candle)
    return
  }
  tfBuffer.push(candle)
  const bucket = Math.floor(candle.ts / tfMs) * tfMs
  const candleEnd = candle.ts + 60_000
  if (candleEnd >= bucket + tfMs) {
    const merged = aggregateSeries(tfBuffer, tfMs).at(-1)
    tfBuffer = []
    if (merged) onTfCandleClosed(merged)
  }
}

function onTfCandleClosed(candle: FootprintCandle): void {
  if (!detector) return
  const divergence = detector.push(candle)
  if (!session || useSessionStore.getState().phase !== 'armed') return
  const update = session.onCandleClose(candle, divergence)
  const prev = useSessionStore.getState()
  useSessionStore.setState({
    cvdDivergence: session.cvdDivergenceSeen,
    candleCount: update.metrics.length,
    snapshot: update.snapshot,
    events: [...prev.events, ...update.events].slice(-200),
  })
}

export function arm(params: ArmParams): void {
  session = new AnalysisSession(params)
  useSessionStore.setState({
    phase: 'armed',
    zoneHigh: session.zoneHigh,
    zoneLow: session.zoneLow,
    levelKind: session.levelKind,
    attack: session.attack,
    trend: session.trend,
    isRetest: session.isRetest,
    cvdDivergence: false,
    candleCount: 0,
    snapshot: null,
    events: [
      {
        ts: Date.now(),
        kind: 'signal',
        text: `armed ${session.levelKind} zone ${session.zoneLow}–${session.zoneHigh} — attack ${session.attack}, trend ${session.trend}${session.isRetest ? ' (retest: reduced confidence)' : ''}`,
      },
    ],
  })
}

export function disarm(): void {
  session = null
  useSessionStore.getState().reset()
}

/** Freeze the session and open the labeling flow (candles stop feeding it). */
export function endSession(): void {
  if (!session) return
  useSessionStore.setState({ phase: 'labeling' })
}

export function activeSession(): AnalysisSession | null {
  return session
}

export function setTimeframe(tf: Timeframe): void {
  useMarketStore.getState().setTimeframe(tf)
  tfBuffer = []
  void refreshWarmup()
}

async function refreshWarmup(): Promise<void> {
  const { symbol, timeframe } = useMarketStore.getState()
  try {
    const warmup = await fetchKlines(symbol, timeframe, 300)
    useMarketStore.setState({ warmup })
  } catch {
    /* keep old warmup */
  }
}
