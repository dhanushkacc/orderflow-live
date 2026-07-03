/**
 * Volume profile key levels — port of the Python reference
 * (orderflow/features/profile.py compute_profile): POC, value area (VAH/VAL),
 * and low-volume-node zones. Used to auto-suggest key levels.
 */

export interface LvnZone {
  from: number
  to: number
}

export interface ProfileResult {
  poc: number
  vah: number
  val: number
  lvnZones: LvnZone[]
  totalVolume: number
}

export interface ProfileConfig {
  /** fraction of total volume covered by the value area */
  vaPct: number
  /** LVN = contiguous bins with volume <= lvnFrac * POC volume */
  lvnFrac: number
}

export const DEFAULT_PROFILE_CONFIG: ProfileConfig = {
  vaPct: 0.7,
  lvnFrac: 0.22,
}

export function computeProfile(
  volumeByPrice: Map<number, number>,
  cfg: ProfileConfig = DEFAULT_PROFILE_CONFIG,
): ProfileResult | null {
  if (volumeByPrice.size === 0) return null
  const prices = [...volumeByPrice.keys()].sort((a, b) => a - b)
  const vols = prices.map((p) => volumeByPrice.get(p)!)
  const total = vols.reduce((s, v) => s + v, 0)
  if (total === 0) return null

  let pocIdx = 0
  for (let i = 1; i < vols.length; i++) if (vols[i] > vols[pocIdx]) pocIdx = i
  const pocVol = vols[pocIdx]

  // expand value area from POC until vaPct of volume is covered
  let covered = pocVol
  let lo = pocIdx
  let hi = pocIdx
  while (covered < cfg.vaPct * total && (lo > 0 || hi < prices.length - 1)) {
    const below = lo > 0 ? vols[lo - 1] : -1
    const above = hi < prices.length - 1 ? vols[hi + 1] : -1
    if (above >= below) {
      hi++
      covered += vols[hi]
    } else {
      lo--
      covered += vols[lo]
    }
  }

  // LVN zones: contiguous runs of thin bins
  const lvnZones: LvnZone[] = []
  const threshold = cfg.lvnFrac * pocVol
  let runStart: number | null = null
  for (let i = 0; i < prices.length; i++) {
    if (vols[i] <= threshold) {
      if (runStart === null) runStart = i
    } else if (runStart !== null) {
      lvnZones.push({ from: prices[runStart], to: prices[i - 1] })
      runStart = null
    }
  }
  if (runStart !== null) lvnZones.push({ from: prices[runStart], to: prices[prices.length - 1] })

  return { poc: prices[pocIdx], vah: prices[hi], val: prices[lo], lvnZones, totalVolume: total }
}
