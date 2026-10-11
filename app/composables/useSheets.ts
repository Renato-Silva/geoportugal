import type { Bbox } from '~/utils/types'

/** Carta Militar de Portugal 1:25 000 sheet index (mainland M888, Azores M889, Madeira P821). */
export interface Sheet {
  series: 'M888' | 'M889' | 'P821'
  sheet: string
  name?: string
}

interface Indexed extends Sheet {
  bbox: Bbox
  rings: number[][][]
}

const geojson = shallowRef<GeoJSON.FeatureCollection | null>(null)
const index = shallowRef<Indexed[]>([])
let loading: Promise<void> | null = null

function load() {
  loading ??= $fetch<GeoJSON.FeatureCollection>('/api/sheets')
    .then((fc) => {
      geojson.value = fc
      index.value = fc.features.map((f) => {
        const g = f.geometry as GeoJSON.Polygon | GeoJSON.MultiPolygon
        const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates
        const rings = polys.map(p => p[0]!)
        const xs = rings.flat().map(c => c[0]!), ys = rings.flat().map(c => c[1]!)
        return { ...(f.properties as Sheet), rings, bbox: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)] as Bbox }
      })
    })
    .catch((e) => {
      console.error('sheets', e)
      loading = null
    })
  return loading
}

function inside([x, y]: [number, number], ring: number[][]) {
  let hit = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]!, [xj, yj] = ring[j]!
    if ((yi! > y) !== (yj! > y) && x < ((xj! - xi!) * (y - yi!)) / (yj! - yi!) + xi!) hit = !hit
  }
  return hit
}

function sheetsAt(p: [number, number]): Sheet[] {
  return index.value.filter(s => p[0] >= s.bbox[0] && p[0] <= s.bbox[2] && p[1] >= s.bbox[1] && p[1] <= s.bbox[3]
    && s.rings.some(r => inside(p, r)))
}

function sheetsIn(b: Bbox): Sheet[] {
  return index.value
    .filter(s => s.bbox[0] < b[2] && s.bbox[2] > b[0] && s.bbox[1] < b[3] && s.bbox[3] > b[1])
    .sort((a, c) => a.series.localeCompare(c.series) || Number(a.sheet) - Number(c.sheet))
}

/** "230" for the mainland series, "M889 10 · Candelária (Pico)" for the islands. */
function sheetLabel(s: Sheet) {
  return s.series === 'M888' ? s.sheet : `${s.series} ${s.sheet}${s.name ? ` · ${s.name}` : ''}`
}

export function useSheets() {
  return { geojson, index, load, sheetsAt, sheetsIn, sheetLabel }
}
