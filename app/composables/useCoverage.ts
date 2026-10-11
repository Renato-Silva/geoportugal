import { from3857 } from '#shared/georef'
import type { Bbox } from '~/utils/types'

/**
 * Archive coverage grid (public/data/coverage.json, built by `npm run build:coverage`).
 * Each row: [ix, iy, cov×7, ctr×7] per decade 1940s…2000s, in 2.5 km Web Mercator cells.
 *   cov — photos overlapping the cell (map colour)
 *   ctr — photos centred in the cell (counting without duplicates)
 */
interface CoverageFile {
  generated: string
  cell: number
  decades: number[]
  photos: number
  rows: number[][]
}

export const DECADES = [1940, 1950, 1960, 1970, 1980, 1990, 2000]

const data = shallowRef<CoverageFile | null>(null)
const geojson = shallowRef<GeoJSON.FeatureCollection | null>(null)
/** Selected decade indexes for the coverage map; empty = all */
const decades = ref<number[]>([])
let loading: Promise<void> | null = null

function load() {
  loading ??= fetch('/data/coverage.json')
    .then(r => r.json() as Promise<CoverageFile>)
    .then((d) => {
      data.value = d
      const c = d.cell
      geojson.value = {
        type: 'FeatureCollection',
        features: d.rows.map(([ix, iy, ...counts]) => {
          const [w, s] = from3857(ix! * c, iy! * c)
          const [e, n] = from3857((ix! + 1) * c, (iy! + 1) * c)
          const props: Record<string, number> = {}
          DECADES.forEach((_, i) => { props[`c${i}`] = counts[i]! })
          return {
            type: 'Feature',
            properties: props,
            geometry: { type: 'Polygon', coordinates: [[[w, s], [e, s], [e, n], [w, n], [w, s]]] },
          }
        }),
      }
    })
    .catch((e) => {
      console.error('coverage', e)
      loading = null
    })
  return loading
}

/** Photos (centred) inside a bbox, per decade — exact enough for an overview. */
function statsIn(b: Bbox) {
  const d = data.value
  const perDecade = DECADES.map(() => 0)
  if (!d) return { total: 0, perDecade }
  const c = d.cell
  for (const row of d.rows) {
    const [lon, lat] = from3857((row[0]! + 0.5) * c, (row[1]! + 0.5) * c)
    if (lon < b[0] || lon > b[2] || lat < b[1] || lat > b[3]) continue
    for (let i = 0; i < DECADES.length; i++) perDecade[i]! += row[2 + DECADES.length + i]!
  }
  return { total: perDecade.reduce((a, b) => a + b, 0), perDecade }
}

/** MapLibre expression: photos overlapping a cell in the selected decades. */
function valueExpression(): any {
  const idx = decades.value.length ? decades.value : DECADES.map((_, i) => i)
  return idx.length === 1 ? ['get', `c${idx[0]}`] : ['+', ...idx.map(i => ['get', `c${i}`])]
}

function toggleDecade(i: number) {
  decades.value = decades.value.includes(i) ? decades.value.filter(d => d !== i) : [...decades.value, i].sort()
}

export function useCoverage() {
  return { data, geojson, decades, load, statsIn, valueExpression, toggleDecade, cellSize: () => data.value?.cell ?? 2500 }
}
