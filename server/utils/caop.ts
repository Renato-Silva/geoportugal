// Administrative boundaries (CAOP) from DGT's GeoServer: districts / islands,
// municipalities and parishes, for mainland Portugal, Madeira and the Azores.

const GEOSERVER = 'https://geo2.dgterritorio.gov.pt/geoserver'

export type AdminLevel = 'district' | 'municipality' | 'parish'

const LEVELS: Record<AdminLevel, { layer: string, code: string, name: string }> = {
  district: { layer: 'distritos', code: 'dt', name: 'distrito' },
  municipality: { layer: 'municipios', code: 'dtmn', name: 'municipio' },
  parish: { layer: 'freguesias', code: 'dtmnfr', name: 'freguesia' },
}

interface Region { ws: string, prefix: string }
const REGIONS: Region[] = [
  { ws: 'caop_continente', prefix: 'cont' },
  { ws: 'caop_ram', prefix: 'ram' },
  { ws: 'caop_raa', prefix: 'raa_cen_ori' },
  { ws: 'caop_raa', prefix: 'raa_oci' },
]

export const isAdminLevel = (v: unknown): v is AdminLevel => typeof v === 'string' && v in LEVELS

/** The first two digits of every CAOP code are the district / island. */
function regionForCode(code: string): Region {
  const dt = Number(code.slice(0, 2))
  if (dt === 31 || dt === 32) return REGIONS[1]!
  if (dt === 48 || dt === 49) return REGIONS[3]!
  if (dt >= 41 && dt <= 47) return REGIONS[2]!
  return REGIONS[0]!
}

function regionForPoint(lon: number, lat: number): Region {
  if (lon < -30) return REGIONS[3]!
  if (lon < -24) return REGIONS[2]!
  if (lat < 34) return REGIONS[1]!
  return REGIONS[0]!
}

async function wfs<T>(region: Region, level: AdminLevel, params: Record<string, string>): Promise<T> {
  const qs = new URLSearchParams({
    service: 'WFS',
    version: '1.1.0',
    request: 'GetFeature',
    typename: `${region.ws}:${region.prefix}_${LEVELS[level].layer}`,
    outputFormat: 'application/json',
    ...params,
  })
  return await $fetch(`${GEOSERVER}/${region.ws}/wfs?${qs}`, { timeout: 30_000, retry: 1 }) as T
}

// ---------------------------------------------------------------------------
// Name index (all units, properties only) for accent-insensitive search
// ---------------------------------------------------------------------------
export interface AdminUnit {
  level: AdminLevel
  code: string
  name: string
  municipality?: string
  district: string
}

export const normalize = (s: string) =>
  s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim()

let index: { at: number, units: Promise<(AdminUnit & { key: string })[]> } | null = null

export function adminIndex() {
  if (index && Date.now() - index.at < 24 * 3600_000) return index.units
  const units = Promise.all(REGIONS.flatMap(region => (Object.keys(LEVELS) as AdminLevel[]).map(async (level) => {
    const L = LEVELS[level]
    const props = level === 'district' ? [L.code, L.name] : [L.code, L.name, 'municipio', 'distrito_ilha']
    const data = await wfs<{ features: { properties: Record<string, string> }[] }>(region, level, {
      propertyName: [...new Set(props)].join(','),
    })
    return data.features.map(({ properties: p }) => ({
      level,
      code: p[L.code]!,
      name: p[L.name]!,
      municipality: level === 'parish' ? p.municipio : undefined,
      district: level === 'district' ? p[L.name]! : p.distrito_ilha!,
      key: normalize(p[L.name]!),
    }))
  }))).then(lists => lists.flat())
  units.catch(() => { index = null })
  index = { at: Date.now(), units }
  return units
}

export async function searchAdmin(q: string, limit = 8): Promise<AdminUnit[]> {
  const needle = normalize(q)
  const rank = { district: 0, municipality: 1, parish: 2 }
  const hits = (await adminIndex())
    .filter(u => u.key.includes(needle))
    .map(u => ({ u, score: (u.key === needle ? 0 : u.key.startsWith(needle) ? 1 : 2) * 10 + rank[u.level] }))
    .sort((a, b) => a.score - b.score || a.u.name.localeCompare(b.u.name))
    .slice(0, limit)
  return hits.map(({ u: { key: _key, ...rest } }) => rest)
}

// ---------------------------------------------------------------------------
// Boundary geometry, simplified for display (EPSG:4326) and querying (EPSG:3763)
// ---------------------------------------------------------------------------
type Ring = number[][]
type MultiPolygon = Ring[][]

/** Douglas–Peucker on a single ring. */
function simplifyRing(ring: Ring, tol: number): Ring {
  if (ring.length <= 4) return ring
  const keep = new Uint8Array(ring.length)
  keep[0] = keep[ring.length - 1] = 1
  const stack: [number, number][] = [[0, ring.length - 1]]
  const tol2 = tol * tol
  while (stack.length) {
    const [a, b] = stack.pop()!
    const [ax, ay] = ring[a]!, [bx, by] = ring[b]!
    const dx = bx! - ax!, dy = by! - ay!
    const len2 = dx * dx + dy * dy
    let maxD = -1, idx = -1
    for (let i = a + 1; i < b; i++) {
      const [px, py] = ring[i]!
      let t = len2 ? ((px! - ax!) * dx + (py! - ay!) * dy) / len2 : 0
      t = Math.max(0, Math.min(1, t))
      const ex = ax! + t * dx - px!, ey = ay! + t * dy - py!
      const d = ex * ex + ey * ey
      if (d > maxD) { maxD = d; idx = i }
    }
    if (maxD > tol2 && idx > 0) {
      keep[idx] = 1
      stack.push([a, idx], [idx, b])
    }
  }
  return ring.filter((_, i) => keep[i])
}

function simplify(mp: MultiPolygon, tol: number): MultiPolygon {
  return mp
    .map(poly => poly.map(r => simplifyRing(r, tol)).filter(r => r.length >= 4))
    .filter(poly => poly.length > 0)
}

const vertexCount = (mp: MultiPolygon) => mp.reduce((n, p) => n + p.reduce((m, r) => m + r.length, 0), 0)

/** Simplify until the polygon is small enough to send inside a filter. */
function simplifyTo(mp: MultiPolygon, startTol: number, maxVertices: number) {
  let tol = startTol
  let out = simplify(mp, tol)
  while (vertexCount(out) > maxVertices) {
    tol *= 1.6
    out = simplify(mp, tol)
  }
  return out
}

interface GeomFeature {
  geometry: { type: 'Polygon' | 'MultiPolygon', coordinates: any }
  properties: Record<string, string>
}

const asMulti = (g: GeomFeature['geometry']): MultiPolygon => g.type === 'Polygon' ? [g.coordinates] : g.coordinates

export interface Boundary {
  level: AdminLevel
  code: string
  name: string
  context: string
  bbox: [number, number, number, number]
  geometry: { type: 'MultiPolygon', coordinates: MultiPolygon }
  /** simplified, PT-TM06 (EPSG:3763) — the footprint layer's native CRS */
  wkt: string
}

export async function fetchBoundary(level: AdminLevel, code: string): Promise<Boundary | null> {
  const region = regionForCode(code)
  const L = LEVELS[level]
  const filter = { CQL_FILTER: `${L.code}='${code.replace(/'/g, '')}'`, maxFeatures: '1' }
  const [geo, tm] = await Promise.all([
    wfs<{ features: GeomFeature[] }>(region, level, { ...filter, srsname: 'EPSG:4326' }),
    wfs<{ features: GeomFeature[] }>(region, level, { ...filter, srsname: 'EPSG:3763' }),
  ])
  const f = geo.features[0], t = tm.features[0]
  if (!f || !t) return null

  const display = simplifyTo(asMulti(f.geometry), 0.00005, 4000)
  const query = simplifyTo(asMulti(t.geometry), 15, 700)
  const xs = display.flatMap(p => p[0]!.map(c => c[0]!)), ys = display.flatMap(p => p[0]!.map(c => c[1]!))
  const ring = (r: Ring) => `(${r.map(([x, y]) => `${x!.toFixed(1)} ${y!.toFixed(1)}`).join(',')})`
  const p = f.properties
  const context = level === 'district' ? '' : level === 'municipality' ? p.distrito_ilha! : `${p.municipio}, ${p.distrito_ilha}`

  return {
    level,
    code,
    name: p[L.name]!,
    context,
    bbox: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)],
    geometry: { type: 'MultiPolygon', coordinates: display },
    wkt: `MULTIPOLYGON(${query.map(poly => `(${poly.map(ring).join(',')})`).join(',')})`,
  }
}

// ---------------------------------------------------------------------------
// Which parish / municipality contains a point
// ---------------------------------------------------------------------------
export interface Location {
  parish?: { code: string, name: string }
  municipality?: string
  district?: string
}

export async function locatePoint(lon: number, lat: number): Promise<Location> {
  const e = 0.00001
  const data = await wfs<{ features: { properties: Record<string, string> }[] }>(regionForPoint(lon, lat), 'parish', {
    propertyName: 'dtmnfr,freguesia,municipio,distrito_ilha',
    CQL_FILTER: `BBOX(geometria,${lon - e},${lat - e},${lon + e},${lat + e},'EPSG:4326')`,
    maxFeatures: '1',
  })
  const p = data.features[0]?.properties
  if (!p) return {}
  return { parish: { code: p.dtmnfr!, name: p.freguesia! }, municipality: p.municipio, district: p.distrito_ilha }
}
