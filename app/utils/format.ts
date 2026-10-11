import type { Photo } from './types'

const nf = (lang: string) => new Intl.NumberFormat(lang === 'pt' ? 'pt-PT' : 'en-GB')

export function formatCount(n: number, lang: string) {
  return nf(lang).format(n)
}

export function formatScale(scale: number | null, lang: string) {
  return scale ? `1:${nf(lang).format(scale)}` : '—'
}

export function formatDate(date: string | null, lang: string, style: 'long' | 'short' = 'long') {
  if (!date) return '—'
  const locale = lang === 'pt' ? 'pt-PT' : 'en-GB'
  const [y, m, d] = date.split('-').map(Number)
  if (!m) return String(y)
  const dt = new Date(Date.UTC(y!, m - 1, d ?? 1))
  return new Intl.DateTimeFormat(locale, {
    timeZone: 'UTC',
    year: 'numeric',
    month: style === 'long' ? 'long' : 'short',
    ...(d ? { day: 'numeric' } : {}),
  }).format(dt)
}

export function photoTitle(p: Photo) {
  return `${p.rolo} · ${p.foto}`
}

/** Key that groups frames into the flight/roll they were shot on. */
export function flightKey(p: Photo) {
  return `${p.date ?? '?'}|${p.rolo}|${p.scale ?? '?'}`
}
