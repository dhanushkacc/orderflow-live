import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Dataset } from '../core/types'

describe('dataset fixture', () => {
  const raw = readFileSync(join(__dirname, 'fixtures', 'dataset.json'), 'utf8')
  const dataset = JSON.parse(raw) as Dataset

  it('parses and holds the 16 seed records', () => {
    expect(dataset.records).toHaveLength(16)
    expect(dataset.records[0].record_id).toBe(1)
    expect(dataset.records.at(-1)?.record_id).toBe(16)
  })

  it('every candle carries the full metric set', () => {
    for (const rec of dataset.records) {
      for (const c of rec.candles) {
        expect(c).toHaveProperty('absorption')
        expect(c).toHaveProperty('price_action')
        expect(c).toHaveProperty('cvd_price_action')
        expect(c).toHaveProperty('volume')
        expect(c).toHaveProperty('delta')
        expect(c).toHaveProperty('max_delta')
        expect(c).toHaveProperty('min_delta')
      }
    }
  })
})
