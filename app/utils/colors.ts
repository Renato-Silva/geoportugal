// Sequential single-hue ramp (blue), indexed by photo year.
// Older flights read lighter, recent ones denser; the dark ramp runs the other way for contrast.
export const YEAR_MIN = 1944
export const YEAR_MAX = 2000

const RAMP_LIGHT = ['#8fb8ff', '#5592ff', '#1f6fff', '#0d4fd6', '#08348f']
const RAMP_DARK = ['#1a4fb8', '#2f6cf0', '#4c8dff', '#82b0ff', '#bcd4ff']

export function yearRamp(dark: boolean) {
  return dark ? RAMP_DARK : RAMP_LIGHT
}

function stopYear(i: number) {
  return YEAR_MIN + (i * (YEAR_MAX - YEAR_MIN)) / (RAMP_LIGHT.length - 1)
}

/** MapLibre interpolate expression over the `year` feature property. */
export function yearColorExpression(dark: boolean): any {
  const ramp = yearRamp(dark)
  return [
    'interpolate', ['linear'], ['coalesce', ['get', 'year'], YEAR_MIN],
    ...ramp.flatMap((c, i) => [stopYear(i), c]),
  ]
}

function hexToRgb(h: string) {
  const n = Number.parseInt(h.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

export function yearColor(year: number | null, dark: boolean) {
  const ramp = yearRamp(dark)
  if (year == null) return ramp[0]!
  const t = Math.min(Math.max((year - YEAR_MIN) / (YEAR_MAX - YEAR_MIN), 0), 1) * (ramp.length - 1)
  const i = Math.min(Math.floor(t), ramp.length - 2)
  const f = t - i
  const a = hexToRgb(ramp[i]!), b = hexToRgb(ramp[i + 1]!)
  return `rgb(${a.map((v, k) => Math.round(v + (b[k]! - v) * f)).join(',')})`
}
