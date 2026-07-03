/**
 * Maps dataset scenario labels to the level geometry the scoring engine needs,
 * and to the ground-truth outcome used by the acceptance replay test.
 * Retests attack the flipped level: after a break-down the retest attacks from
 * BELOW (resistance-style); after a break-up from ABOVE (support-style).
 */
import type { Direction, LevelKind, Scenario } from '../types'

export interface SetupGeometry {
  levelKind: LevelKind
  attack: Direction
  outcome: 'REJECT' | 'BREAK'
  isRetest: boolean
}

export function scenarioGeometry(scenario: Scenario): SetupGeometry {
  switch (scenario) {
    case 'touch_and_reject_up':
      return { levelKind: 'support', attack: 'down', outcome: 'REJECT', isRetest: false }
    case 'touch_and_reject_down':
      return { levelKind: 'resistance', attack: 'up', outcome: 'REJECT', isRetest: false }
    case 'break_down':
      return { levelKind: 'support', attack: 'down', outcome: 'BREAK', isRetest: false }
    case 'break_up':
      return { levelKind: 'resistance', attack: 'up', outcome: 'BREAK', isRetest: false }
    case 'break_up_and_retest_success':
      return { levelKind: 'support', attack: 'down', outcome: 'REJECT', isRetest: true }
    case 'break_up_and_retest_fail':
      return { levelKind: 'support', attack: 'down', outcome: 'BREAK', isRetest: true }
    case 'break_down_and_retest_success':
      return { levelKind: 'resistance', attack: 'up', outcome: 'REJECT', isRetest: true }
    case 'break_down_and_retest_fail':
      return { levelKind: 'resistance', attack: 'up', outcome: 'BREAK', isRetest: true }
  }
}
