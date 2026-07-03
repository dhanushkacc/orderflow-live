/**
 * Dataset persistence: localStorage-backed record list seeded from the bundled
 * 16-record dataset, with import/export of the full dataset.json (schema block
 * preserved so the Python tooling keeps working).
 */
import type { Dataset, SessionRecord } from '../core/types'
import { migrateLegacyRecord } from '../core/scoring/scenario'
import seed from '../test/fixtures/dataset.json'

const KEY = 'orderflow-live:dataset:v2'

const SEED = seed as unknown as Dataset

function upgrade(ds: Dataset): Dataset {
  return {
    schema: SEED.schema,
    records: ds.records.map((r) => migrateLegacyRecord(r as unknown as Record<string, unknown>)),
  }
}

function load(): Dataset {
  try {
    const raw = localStorage.getItem(KEY) ?? localStorage.getItem('orderflow-live:dataset:v1')
    if (raw) return upgrade(JSON.parse(raw) as Dataset)
  } catch {
    /* corrupted -> reseed */
  }
  return { schema: SEED.schema, records: [...SEED.records] }
}

function save(ds: Dataset): void {
  localStorage.setItem(KEY, JSON.stringify(ds))
}

export function getDataset(): Dataset {
  return load()
}

export function recordCount(): number {
  return load().records.length
}

export function nextRecordId(): number {
  const ds = load()
  return ds.records.reduce((m, r) => Math.max(m, r.record_id), 0) + 1
}

export function appendRecord(record: SessionRecord): Dataset {
  const ds = load()
  ds.records.push(record)
  save(ds)
  return ds
}

export function importDataset(json: string): Dataset {
  const parsed = JSON.parse(json) as Dataset
  if (!Array.isArray(parsed.records)) throw new Error('invalid dataset: missing records[]')
  // legacy scenario-labelled files are upgraded automatically
  const ds = upgrade({ schema: parsed.schema ?? SEED.schema, records: parsed.records })
  save(ds)
  return ds
}

export function exportDataset(): string {
  return JSON.stringify(load(), null, 2)
}

export function downloadDataset(): void {
  const blob = new Blob([exportDataset()], { type: 'application/json' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = 'dataset.json'
  a.click()
  URL.revokeObjectURL(a.href)
}
