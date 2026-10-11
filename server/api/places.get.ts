import { type Bbox, fetchLegacyJson } from '../utils/fototeca'

interface ToponymFeature {
  geometry: { coordinates: number[][][] }
  properties: { geographic: string, altGeograp: string }
}

export interface Place {
  id: string
  name: string
  context: string
  bbox: Bbox
}

export default defineCachedEventHandler(async (event): Promise<Place[]> => {
  const q = String(getQuery(event).q ?? '').trim()
  if (q.length < 2) return []

  const data = await fetchLegacyJson<{ features: ToponymFeature[] }>('toponimia', { nome: q })
  const seen = new Set<string>()
  const places: Place[] = []
  for (const f of data.features ?? []) {
    const ring = f.geometry?.coordinates?.[0]
    if (!ring?.length) continue
    const xs = ring.map(c => c[0]!)
    const ys = ring.map(c => c[1]!)
    const bbox: Bbox = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]
    const label = f.properties.altGeograp ?? f.properties.geographic
    if (seen.has(label)) continue
    seen.add(label)
    const [name, ...rest] = label.split(',').map(s => s.trim())
    places.push({ id: label, name: name!, context: rest.join(', '), bbox })
  }
  return places
}, {
  maxAge: 60 * 60 * 24,
  name: 'places',
  getKey: event => String(getQuery(event).q ?? '').trim().toLowerCase(),
})
