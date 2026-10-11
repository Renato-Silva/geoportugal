import { type AdminUnit, normalize, searchAdmin } from '../utils/caop'

// Geographic names gazetteer (DGT/INE): accent- and typo-tolerant, returns points.
const GEONAMES = 'https://snic.dgterritorio.gov.pt/geoportal/geonames/api/v1/search'

interface GeonameHit {
  geom_wkt: string
  name: string
  type: string
  admin_level2: string | null
  admin_level3: string | null
  admin_level4: string | null
  admin_code: string | null
}

export interface GeoPlace {
  id: string
  name: string
  type: string
  municipality: string | null
  parish: string | null
  point: [number, number]
}

export interface PlaceResults {
  admin: AdminUnit[]
  places: GeoPlace[]
}

async function searchGeonames(q: string): Promise<GeoPlace[]> {
  const hits = await $fetch<GeonameHit[]>(GEONAMES, {
    query: { _min_similarity: '0.2', _maxrows: '20', _filter: q },
    timeout: 15_000,
    retry: 1,
  })
  const seen = new Set<string>()
  const out: GeoPlace[] = []
  for (const h of hits) {
    const m = /\(\(?\s*(-?[\d.]+)\s+(-?[\d.]+)/.exec(h.geom_wkt)
    if (!m) continue
    // The gazetteer lists most places twice (INE and DGT sources)
    const key = `${h.name}|${h.type}|${h.admin_code}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push({
      id: key,
      name: h.name,
      type: h.type,
      municipality: h.admin_level3,
      parish: h.admin_level4,
      point: [Number(m[1]), Number(m[2])],
    })
  }
  // The gazetteer pads results with loose matches ("Eira" for "evora"); keep real ones.
  const needle = normalize(q)
  const close = out.filter(p => normalize(p.name).includes(needle))
  return (close.length ? close : out.slice(0, 3)).slice(0, 8)
}

export default defineCachedEventHandler(async (event): Promise<PlaceResults> => {
  const q = String(getQuery(event).q ?? '').trim()
  if (q.length < 2) return { admin: [], places: [] }
  const [admin, places] = await Promise.all([
    searchAdmin(q).catch((e) => { console.warn('[places] admin search failed:', e.message); return [] }),
    searchGeonames(q).catch((e) => { console.warn('[places] geonames failed:', e.message); return [] }),
  ])
  return { admin, places }
}, {
  maxAge: 60 * 60 * 24,
  name: 'places-v2',
  getKey: event => String(getQuery(event).q ?? '').trim().toLowerCase(),
})
