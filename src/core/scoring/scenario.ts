/**
 * Legacy-scenario migration: old dataset files labelled records with an
 * 8-value scenario string. The current schema stores level_kind + outcome +
 * retest directly; this mapping upgrades old records on import.
 */
import type { LevelKind, Outcome, SessionRecord } from '../types'

interface LegacyGeometry {
  level_kind: LevelKind
  outcome: Outcome
  retest: boolean
}

const LEGACY_SCENARIOS: Record<string, LegacyGeometry> = {
  touch_and_reject_up: { level_kind: 'support', outcome: 'reject', retest: false },
  touch_and_reject_down: { level_kind: 'resistance', outcome: 'reject', retest: false },
  break_down: { level_kind: 'support', outcome: 'break', retest: false },
  break_up: { level_kind: 'resistance', outcome: 'break', retest: false },
  break_up_and_retest_success: { level_kind: 'support', outcome: 'reject', retest: true },
  break_up_and_retest_fail: { level_kind: 'support', outcome: 'break', retest: true },
  break_down_and_retest_success: { level_kind: 'resistance', outcome: 'reject', retest: true },
  break_down_and_retest_fail: { level_kind: 'resistance', outcome: 'break', retest: true },
}

/** Upgrade a record that may still carry a legacy `scenario` field. */
export function migrateLegacyRecord(raw: Record<string, unknown>): SessionRecord {
  if (typeof raw.scenario === 'string') {
    const geo = LEGACY_SCENARIOS[raw.scenario]
    if (!geo) throw new Error(`unknown legacy scenario: ${raw.scenario}`)
    const { scenario: _dropped, ...rest } = raw
    return { ...rest, ...geo } as unknown as SessionRecord
  }
  return raw as unknown as SessionRecord
}
