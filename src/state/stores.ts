import { create } from 'zustand'
import type {
  DepthSnapshot,
  Direction,
  FootprintCandle,
  ScoreSnapshot,
  Timeframe,
} from '../core/types'
import type { FeedStatus } from '../feed/binanceWs'
import type { CommentaryEvent } from '../core/scoring/commentary'
import type { Kline } from '../feed/binanceRest'
import type { DominanceState } from '../core/depth/depthMetrics'

export const MAX_1M_HISTORY = 720 // 12h of base candles kept in memory

interface MarketState {
  symbol: string
  timeframe: Timeframe
  status: FeedStatus
  statusDetail: string
  /** display-only warmup bars for the active timeframe (from klines REST) */
  warmup: Kline[]
  /** closed live-built 1m footprint candles */
  candles1m: FootprintCandle[]
  forming: FootprintCandle | null
  lastPrice: number | null
  depth: DepthSnapshot | null
  dominance: DominanceState | null
  setSymbol: (s: string) => void
  setTimeframe: (tf: Timeframe) => void
}

export const useMarketStore = create<MarketState>((set) => ({
  symbol: 'BTCUSDT',
  timeframe: '1m',
  status: 'closed',
  statusDetail: '',
  warmup: [],
  candles1m: [],
  forming: null,
  lastPrice: null,
  depth: null,
  dominance: null,
  setSymbol: (symbol) => set({ symbol }),
  setTimeframe: (timeframe) => set({ timeframe }),
}))

export interface SessionView {
  phase: 'idle' | 'armed' | 'labeling'
  zoneHigh: number | null
  zoneLow: number | null
  levelKind: 'support' | 'resistance' | null
  attack: Direction | null
  trend: Direction | null
  isRetest: boolean
  cvdDivergence: boolean
  candleCount: number
  snapshot: ScoreSnapshot | null
  events: CommentaryEvent[]
}

interface SessionState extends SessionView {
  reset: () => void
}

const idleSession: SessionView = {
  phase: 'idle',
  zoneHigh: null,
  zoneLow: null,
  levelKind: null,
  attack: null,
  trend: null,
  isRetest: false,
  cvdDivergence: false,
  candleCount: 0,
  snapshot: null,
  events: [],
}

export const useSessionStore = create<SessionState>((set) => ({
  ...idleSession,
  reset: () => set({ ...idleSession }),
}))

/** Draft key zone being typed / picked by clicking the chart twice, before arming. */
interface DraftState {
  high: string
  low: string
  /** which edge the next chart click fills */
  nextClick: 'high' | 'low'
  setHigh: (v: string) => void
  setLow: (v: string) => void
  /** chart click: fill edges alternately */
  clickPrice: (price: number) => void
  clear: () => void
}

export const useDraftStore = create<DraftState>((set, get) => ({
  high: '',
  low: '',
  nextClick: 'high',
  setHigh: (high) => set({ high }),
  setLow: (low) => set({ low }),
  clickPrice: (price) => {
    const v = price.toFixed(2)
    if (get().nextClick === 'high') set({ high: v, nextClick: 'low' })
    else set({ low: v, nextClick: 'high' })
  },
  clear: () => set({ high: '', low: '', nextClick: 'high' }),
}))

interface RecordsState {
  count: number
  setCount: (n: number) => void
}

export const useRecordsStore = create<RecordsState>((set) => ({
  count: 0,
  setCount: (count) => set({ count }),
}))
