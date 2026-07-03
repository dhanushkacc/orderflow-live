import { describe, it, expect } from 'vitest'
import { parseKline, parseRestAggTrade } from './binanceRest'
import { parseWsAggTrade, parseWsDepth } from './binanceWs'

describe('binance parsers', () => {
  it('parses a WS aggTrade — m=true means sell aggressor', () => {
    const t = parseWsAggTrade({ e: 'aggTrade', a: 12345, p: '43210.50', q: '0.25', T: 1719900000000, m: true })
    expect(t).toEqual({ id: 12345, price: 43210.5, qty: 0.25, time: 1719900000000, isBuyerMaker: true })
  })

  it('parses a REST aggTrade row', () => {
    const t = parseRestAggTrade({ a: 7, p: '100.1', q: '2', f: 1, l: 3, T: 1000, m: false })
    expect(t).toEqual({ id: 7, price: 100.1, qty: 2, time: 1000, isBuyerMaker: false })
  })

  it('parses a kline row', () => {
    const k = parseKline([1719900000000, '100', '110', '90', '105', '1234.5', 1719900059999])
    expect(k).toEqual({
      openTime: 1719900000000,
      open: 100,
      high: 110,
      low: 90,
      close: 105,
      volume: 1234.5,
      closeTime: 1719900059999,
    })
  })

  it('parses a depth snapshot with numeric conversion and receive time', () => {
    const d = parseWsDepth(
      { lastUpdateId: 1, bids: [['99.5', '3'], ['99.0', '1.5']], asks: [['100.5', '2']] },
      1719900001234,
    )
    expect(d.time).toBe(1719900001234)
    expect(d.bids).toEqual([[99.5, 3], [99, 1.5]])
    expect(d.asks).toEqual([[100.5, 2]])
  })
})
