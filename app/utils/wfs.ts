import type { Bbox, Photo, PhotoFilter } from './types'
import { bboxOfRing } from './geo'

// GeoServer behind the Fototeca. Unlike the legacy endpoints it sends CORS headers,
// so the browser can query it directly.
const WFS_URL = 'https://geo2.dgterritorio.gov.pt/geoserver/webfototeca/wfs'
const TYPE_NAME = 'dgt:Enquadramento_fotos_v2'

interface WfsFeature {
  id: string
  geometry: GeoJSON.Polygon | null
  properties: Record<string, string | number | null>
}

interface WfsResponse {
  features: WfsFeature[]
  numberMatched?: number
  totalFeatures?: number
}

const quote = (s: string) => `'${s.replace(/'/g, '\'\'')}'`

export function buildCql(f: PhotoFilter) {
  const parts = [`BBOX(the_geom,${f.bbox.join(',')},'EPSG:4326')`]
  parts.push(`DATAFOTO >= '${f.years[0]}0000'`, `DATAFOTO <= '${f.years[1]}9999'`)
  if (f.scales.length) parts.push(`ESCALA IN (${f.scales.map(s => quote(String(s))).join(',')})`)
  return parts.join(' AND ')
}

function parseDate(raw: string | null): { date: string | null, year: number | null } {
  if (!raw || !/^\d{8}$/.test(raw) || raw.startsWith('0000')) return { date: null, year: null }
  const y = raw.slice(0, 4), m = raw.slice(4, 6), d = raw.slice(6, 8)
  const date = m === '00' ? y : d === '00' ? `${y}-${m}` : `${y}-${m}-${d}`
  return { date, year: Number(y) }
}

const num = (v: unknown) => {
  const n = Number(v)
  return v == null || v === '' || !Number.isFinite(n) ? null : n
}

function toPhoto(f: WfsFeature): Photo | null {
  if (!f.geometry || f.geometry.type !== 'Polygon') return null
  const p = f.properties
  const rolo = String(p.NUMROLO ?? '')
  const foto = String(p.NUMFOTO ?? '')
  return {
    uid: `${rolo}_${foto}`,
    rolo,
    foto,
    fiada: String(p.NUMFIADA ?? ''),
    ...parseDate(p.DATAFOTO as string | null),
    scale: num(p.ESCALA),
    work: String(p.NOMETRAB ?? ''),
    support: String(p.SUPORTEORI ?? ''),
    format: num(p.DIMENSAO),
    resolution: num(p.RES),
    focal: num(p.DISTFOCAL),
    file: String(p.NOME_IMAGE ?? ''),
    bbox: bboxOfRing(f.geometry.coordinates[0]!),
    geometry: f.geometry,
  }
}

async function getFeatures(params: Record<string, string>, signal?: AbortSignal) {
  const qs = new URLSearchParams({
    service: 'WFS',
    version: '1.1.0',
    request: 'GetFeature',
    typename: TYPE_NAME,
    outputFormat: 'application/json',
    srsname: 'EPSG:4326',
    ...params,
  })
  const res = await fetch(`${WFS_URL}?${qs}`, { signal })
  if (!res.ok) throw new Error(`WFS ${res.status}`)
  const data = await res.json() as WfsResponse
  const photos = data.features.map(toPhoto).filter((p): p is Photo => !!p)
  return { photos, total: data.numberMatched ?? data.totalFeatures ?? photos.length }
}

export function fetchPhotos(filter: PhotoFilter, opts: { start?: number, count?: number, newestFirst?: boolean, signal?: AbortSignal } = {}) {
  const dir = opts.newestFirst ? 'D' : 'A'
  return getFeatures({
    CQL_FILTER: buildCql(filter),
    maxFeatures: String(opts.count ?? 200),
    startIndex: String(opts.start ?? 0),
    sortBy: `DATAFOTO ${dir},NUMROLO A,NUMFIADA A,NUMFOTO A`,
  }, opts.signal)
}

/** Look up specific frames (for shared links and restoring overlays). */
export async function fetchPhotosByUid(uids: string[]): Promise<Photo[]> {
  const ids = uids.map((u) => {
    const i = u.lastIndexOf('_')
    return [u.slice(0, i), u.slice(i + 1)]
  }).filter(p => /^[\w./-]+$/.test(p[0]!) && /^\w+$/.test(p[1]!))
  if (!ids.length) return []
  const cql = ids.map(([r, f]) => `(NUMROLO=${quote(r!)} AND NUMFOTO=${quote(f!)})`).join(' OR ')
  const { photos } = await getFeatures({ CQL_FILTER: cql, maxFeatures: String(ids.length * 2) })
  const order = new Map(uids.map((u, i) => [u, i]))
  return photos.sort((a, b) => (order.get(a.uid) ?? 0) - (order.get(b.uid) ?? 0))
}

export function photosAsGeoJSON(photos: Photo[]): GeoJSON.FeatureCollection<GeoJSON.Polygon> {
  return {
    type: 'FeatureCollection',
    features: photos.map(p => ({
      type: 'Feature',
      id: p.uid,
      geometry: p.geometry,
      properties: {
        uid: p.uid, rolo: p.rolo, foto: p.foto, fiada: p.fiada, date: p.date, year: p.year,
        scale: p.scale, work: p.work, support: p.support, focal: p.focal, file: p.file,
      },
    })),
  }
}

