/**
 * Binance REST client (spot public market data).
 * data-api.binance.vision mirrors api.binance.com for public endpoints and is CORS-safe from browsers.
 */
import type { AggTrade } from '../core/types'

const SPOT_REST = 'https://data-api.binance.vision'

export interface Kline {
  openTime: number
  open: number
  high: number
  low: number
  close: number
  volume: number
  closeTime: number
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Binance REST ${res.status}: ${url}`)
  return res.json() as Promise<T>
}

type RawKline = [number, string, string, string, string, string, number, ...unknown[]]

export function parseKline(row: RawKline): Kline {
  return {
    openTime: row[0],
    open: Number(row[1]),
    high: Number(row[2]),
    low: Number(row[3]),
    close: Number(row[4]),
    volume: Number(row[5]),
    closeTime: row[6],
  }
}

export async function fetchKlines(symbol: string, interval: string, limit = 500): Promise<Kline[]> {
  const rows = await getJson<RawKline[]>(
    `${SPOT_REST}/api/v3/klines?symbol=${symbol.toUpperCase()}&interval=${interval}&limit=${limit}`,
  )
  return rows.map(parseKline)
}

interface RawAggTrade {
  a: number
  p: string
  q: string
  f: number
  l: number
  T: number
  m: boolean
}

export function parseRestAggTrade(raw: RawAggTrade): AggTrade {
  return { id: raw.a, price: Number(raw.p), qty: Number(raw.q), time: raw.T, isBuyerMaker: raw.m }
}

/** Fetch aggTrades starting at fromId (inclusive). Used for gap backfill after reconnects. */
export async function fetchAggTradesFrom(symbol: string, fromId: number, limit = 1000): Promise<AggTrade[]> {
  const rows = await getJson<RawAggTrade[]>(
    `${SPOT_REST}/api/v3/aggTrades?symbol=${symbol.toUpperCase()}&fromId=${fromId}&limit=${limit}`,
  )
  return rows.map(parseRestAggTrade)
}

/** Fetch recent aggTrades within a time window (warmup of the forming candle history). */
export async function fetchAggTradesRange(
  symbol: string,
  startTime: number,
  endTime: number,
): Promise<AggTrade[]> {
  const out: AggTrade[] = []
  let cursor = startTime
  for (let guard = 0; guard < 60; guard++) {
    const rows = await getJson<RawAggTrade[]>(
      `${SPOT_REST}/api/v3/aggTrades?symbol=${symbol.toUpperCase()}&startTime=${cursor}&endTime=${endTime}&limit=1000`,
    )
    if (rows.length === 0) break
    out.push(...rows.map(parseRestAggTrade))
    if (rows.length < 1000) break
    cursor = rows[rows.length - 1].T + 1
  }
  return out
}
