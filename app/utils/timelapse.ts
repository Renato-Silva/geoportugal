import type { Photo } from './types'
import { fetchPhotos } from './wfs'
import { pointBbox } from './geo'

export interface Frame {
  id: string
  kind: 'photo' | 'ortho'
  year: number
  /** YYYY-MM-DD / YYYY-MM / YYYY */
  date: string
  photo?: Photo
  orthoYear?: number
}

/** Orthophoto years shown at the end of every time-lapse (DGT WMS; 2023 = satellite). */
export const TIMELAPSE_ORTHO_YEARS = [2007, 2010, 2012, 2015, 2018, 2021, 2023]

// Orthophotos only cover mainland Portugal
const inMainland = ([lon, lat]: [number, number]) => lon > -9.7 && lon < -6 && lat > 36.8 && lat < 42.3

function inside([x, y]: [number, number], ring: number[][]) {
  let hit = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]!, [xj, yj] = ring[j]!
    if ((yi! > y) !== (yj! > y) && x < ((xj! - xi!) * (y - yi!)) / (yj! - yi!) + xi!) hit = !hit
  }
  return hit
}

/**
 * Every flight that photographed a point, oldest first — one frame per flight
 * (date + scale), choosing the frame whose centre is nearest the point (least
 * lens distortion) — followed by the orthophoto years.
 */
export async function buildFrames(point: [number, number], signal?: AbortSignal): Promise<Frame[]> {
  const { photos } = await fetchPhotos(
    { bbox: pointBbox(point, 0.00005), years: [1900, 2100], scales: [] },
    { count: 1000, signal },
  )
  const best = new Map<string, { photo: Photo, d: number }>()
  for (const p of photos) {
    if (!p.date || !inside(point, p.geometry.coordinates[0]!)) continue
    const cx = (p.bbox[0] + p.bbox[2]) / 2, cy = (p.bbox[1] + p.bbox[3]) / 2
    const d = (cx - point[0]) ** 2 + (cy - point[1]) ** 2
    const key = `${p.date}|${p.scale}`
    const cur = best.get(key)
    if (!cur || d < cur.d) best.set(key, { photo: p, d })
  }
  const frames: Frame[] = [...best.values()]
    .map(({ photo }) => ({ id: photo.uid, kind: 'photo' as const, year: photo.year!, date: photo.date!, photo }))
    .sort((a, b) => a.date.localeCompare(b.date))
  if (inMainland(point)) {
    for (const y of TIMELAPSE_ORTHO_YEARS)
      frames.push({ id: `ortho-${y}`, kind: 'ortho', year: y, date: String(y), orthoYear: y })
  }
  return frames
}

export function frameUrl(f: Frame, point: [number, number], m: number, px = 512) {
  const q = new URLSearchParams({ lon: point[0].toFixed(6), lat: point[1].toFixed(6), m: String(m), px: String(px) })
  if (f.kind === 'ortho') return `/api/ortho-crop?year=${f.orthoYear}&${q}`
  const p = f.photo!
  q.set('rolo', p.rolo)
  q.set('foto', p.foto)
  q.set('bbox', p.bbox.map(n => n.toFixed(6)).join(','))
  return `/api/crop?${q}`
}
