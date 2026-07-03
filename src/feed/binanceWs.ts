/**
 * Binance combined WebSocket feed: <sym>@aggTrade + <sym>@depth20@100ms (spot).
 * - exponential backoff reconnect
 * - stall watchdog: no message for STALL_MS forces a reconnect
 * - aggTrade gap detection: missed ids are backfilled via REST and replayed in order
 */
import type { AggTrade, DepthSnapshot } from '../core/types'
import { fetchAggTradesFrom } from './binanceRest'

const SPOT_WS = 'wss://stream.binance.com:9443/stream'
const STALL_MS = 30_000
const BACKOFF_BASE_MS = 1_000
const BACKOFF_MAX_MS = 30_000

export type FeedStatus = 'connecting' | 'open' | 'reconnecting' | 'closed'

export interface FeedCallbacks {
  onTrade: (t: AggTrade) => void
  onDepth?: (d: DepthSnapshot) => void
  onStatus?: (s: FeedStatus, detail?: string) => void
}

interface WsAggTrade {
  e: 'aggTrade'
  a: number
  p: string
  q: string
  T: number
  m: boolean
}

interface WsDepth {
  lastUpdateId: number
  bids: [string, string][]
  asks: [string, string][]
}

type CombinedMessage = { stream: string; data: WsAggTrade | WsDepth }

export function parseWsAggTrade(d: WsAggTrade): AggTrade {
  return { id: d.a, price: Number(d.p), qty: Number(d.q), time: d.T, isBuyerMaker: d.m }
}

export function parseWsDepth(d: WsDepth, receivedAt: number): DepthSnapshot {
  return {
    time: receivedAt,
    bids: d.bids.map(([p, q]) => [Number(p), Number(q)] as [number, number]),
    asks: d.asks.map(([p, q]) => [Number(p), Number(q)] as [number, number]),
  }
}

export class BinanceFeed {
  private ws: WebSocket | null = null
  private symbol: string
  private cb: FeedCallbacks
  private lastTradeId = -1
  private lastMessageAt = 0
  private watchdog: ReturnType<typeof setInterval> | null = null
  private reconnectAttempt = 0
  private stopped = false
  private backfilling = false
  private pendingLive: AggTrade[] = []

  constructor(symbol: string, callbacks: FeedCallbacks) {
    this.symbol = symbol.toLowerCase()
    this.cb = callbacks
  }

  start(): void {
    this.stopped = false
    this.connect()
    this.watchdog = setInterval(() => this.checkStall(), 5_000)
  }

  stop(): void {
    this.stopped = true
    if (this.watchdog) clearInterval(this.watchdog)
    this.watchdog = null
    this.ws?.close()
    this.ws = null
    this.cb.onStatus?.('closed')
  }

  private connect(): void {
    const streams = `${this.symbol}@aggTrade/${this.symbol}@depth20@100ms`
    this.cb.onStatus?.(this.reconnectAttempt === 0 ? 'connecting' : 'reconnecting')
    const ws = new WebSocket(`${SPOT_WS}?streams=${streams}`)
    this.ws = ws

    ws.onopen = () => {
      this.reconnectAttempt = 0
      this.lastMessageAt = Date.now()
      this.cb.onStatus?.('open')
      if (this.lastTradeId >= 0) void this.backfillGap()
    }

    ws.onmessage = (ev: MessageEvent<string>) => {
      this.lastMessageAt = Date.now()
      const msg = JSON.parse(ev.data) as CombinedMessage
      if (msg.stream.endsWith('@aggTrade')) {
        this.handleTrade(parseWsAggTrade(msg.data as WsAggTrade))
      } else if (this.cb.onDepth) {
        this.cb.onDepth(parseWsDepth(msg.data as WsDepth, Date.now()))
      }
    }

    ws.onclose = () => {
      if (this.stopped || this.ws !== ws) return
      this.scheduleReconnect()
    }

    ws.onerror = () => {
      ws.close()
    }
  }

  private handleTrade(t: AggTrade): void {
    if (this.backfilling) {
      this.pendingLive.push(t)
      return
    }
    if (this.lastTradeId >= 0 && t.id > this.lastTradeId + 1) {
      this.pendingLive.push(t)
      void this.backfillGap()
      return
    }
    if (t.id <= this.lastTradeId) return
    this.lastTradeId = t.id
    this.cb.onTrade(t)
  }

  /** Fetch trades between lastTradeId and the live stream, emit them in order, then drain buffered live trades. */
  private async backfillGap(): Promise<void> {
    if (this.backfilling) return
    this.backfilling = true
    try {
      for (let guard = 0; guard < 20; guard++) {
        const missing = await fetchAggTradesFrom(this.symbol, this.lastTradeId + 1)
        if (missing.length === 0) break
        for (const t of missing) {
          if (t.id <= this.lastTradeId) continue
          this.lastTradeId = t.id
          this.cb.onTrade(t)
        }
        const firstPending = this.pendingLive[0]
        if (firstPending && this.lastTradeId >= firstPending.id - 1) break
        if (missing.length < 1000) break
      }
    } catch {
      // backfill failed (network); live trades will re-trigger it via the gap check
    } finally {
      this.backfilling = false
      const buffered = this.pendingLive
      this.pendingLive = []
      for (const t of buffered) this.handleTrade(t)
    }
  }

  private checkStall(): void {
    if (this.stopped || this.lastMessageAt === 0) return
    if (Date.now() - this.lastMessageAt > STALL_MS) {
      this.lastMessageAt = Date.now()
      this.ws?.close()
    }
  }

  private scheduleReconnect(): void {
    const delay = Math.min(BACKOFF_BASE_MS * 2 ** this.reconnectAttempt, BACKOFF_MAX_MS)
    this.reconnectAttempt++
    this.cb.onStatus?.('reconnecting', `retry in ${Math.round(delay / 1000)}s`)
    setTimeout(() => {
      if (!this.stopped) this.connect()
    }, delay)
  }
}
