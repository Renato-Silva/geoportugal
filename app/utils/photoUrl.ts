import type { Photo } from './types'

export type PhotoSize = 'thumb' | 'full' | 'original'

/** Film-border trim applied when "clean edges" is on. */
export const TRIM = 0.1

export function photoUrl(p: Pick<Photo, 'rolo' | 'foto'>, size: PhotoSize = 'full', opts: { trim?: boolean, download?: boolean } = {}) {
  const q = new URLSearchParams({ rolo: p.rolo, foto: p.foto })
  if (size !== 'full') q.set('size', size)
  if (opts.trim && size !== 'original') q.set('trim', String(TRIM))
  if (opts.download) q.set('download', '1')
  return `/api/photo?${q}`
}

/** The legacy DGT URL for the same frame — handy for citing the source. */
export function sourceUrl(p: Pick<Photo, 'rolo' | 'foto'>) {
  return `https://geo5.dgterritorio.gov.pt/fototeca/imagem?NUMROLO=${encodeURIComponent(p.rolo)}&NUMFOTO=${encodeURIComponent(p.foto)}`
}
