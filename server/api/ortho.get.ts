import { archived } from '../utils/archive'
import { ORTHO_SOURCES, orthoImage } from '../utils/ortho'

/**
 * GET /api/ortho?year=2021&z=…&x=…&y=…
 *
 * Proxy for DGT's orthophoto WMS, as XYZ tiles. Its responses carry a duplicated
 * Access-Control-Allow-Origin header, which browsers reject. Tiles are passed
 * through untouched (PNG) and kept in the archive after the first fetch.
 */
const HALF = 20037508.342789244

function tileBbox(z: number, x: number, y: number) {
  const size = (2 * HALF) / 2 ** z
  const minx = -HALF + x * size
  const maxy = HALF - y * size
  return [minx, maxy - size, minx + size, maxy]
}

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const year = String(query.year ?? '')
  const [z, x, y] = [query.z, query.x, query.y].map(Number) as [number, number, number]
  const valid = year in ORTHO_SOURCES && Number.isInteger(z) && Number.isInteger(x) && Number.isInteger(y)
    && z >= 0 && z <= 20 && x >= 0 && y >= 0 && x < 2 ** z && y < 2 ** z
  if (!valid) throw createError({ statusCode: 400, statusMessage: 'year, z, x, y required' })

  const png = await archived(`ortho:${year}:${z}:${x}:${y}.png`, () => orthoImage(year, tileBbox(z, x, y), 256))
  setHeader(event, 'Content-Type', 'image/png')
  setHeader(event, 'Cache-Control', 'public, max-age=604800')
  return png
})
