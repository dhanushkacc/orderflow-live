/** All displayed times use Sri Lanka time (Asia/Colombo, UTC+5:30). */
export const APP_TZ = 'Asia/Colombo'
/** offset in seconds, used to shift chart timestamps so the axis reads Colombo time */
export const APP_TZ_OFFSET_SEC = 5.5 * 3600

export function fmtNum(x: number | null | undefined, dp?: number): string {
  if (x == null || Number.isNaN(x)) return '–'
  const abs = Math.abs(x)
  const digits = dp ?? (abs >= 100 ? 0 : abs >= 1 ? 2 : 4)
  return x.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: digits })
}

export function fmtSigned(x: number | null | undefined, dp?: number): string {
  if (x == null || Number.isNaN(x)) return '–'
  return (x > 0 ? '+' : '') + fmtNum(x, dp)
}

export function fmtClock(ts: number): string {
  return new Date(ts).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZone: APP_TZ,
  })
}
