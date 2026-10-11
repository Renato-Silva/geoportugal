import sharp from 'sharp'
import { archived } from '../utils/archive'

/**
 * GET /api/ortho?year=2021&z=…&x=…&y=…
 *
 * Proxy for DGT's orthophoto WMS, as XYZ tiles. Its responses carry a duplicated
 * Access-Control-Allow-Origin header, which browsers reject. Tiles are passed
 * through untouched (PNG) and kept in the archive after the first fetch.
 */
// Years DGT publishes as a public WMS (1995, 2004 and 2025 exist only behind the CDD login).
const YEARS = new Set(['2007', '2010', '2012', '2015', '2018', '2021'])
const HALF = 20037508.342789244

function tileBbox(z: number, x: number, y: number) {
  const size = (2 * HALF) / 2 ** z
  const minx = -HALF + x * size
  const maxy = HALF - y * size
  return [minx, maxy - size, minx + size, maxy]
}

async function fetchWms(year: string, bbox: number[], px: number): Promise<Buffer | null> {
  const url = `https://cartografia.dgterritorio.gov.pt/ortos${year}/service?service=WMS&version=1.1.1&request=GetMap`
    + `&layers=DGT_Ortos${year}&styles=&srs=EPSG:3857&bbox=${bbox.join(',')}&width=${px}&height=${px}&format=image/png`
  const res = await fetch(url, { signal: AbortSignal.timeout(30_000) })
  // The WMS answers errors with HTTP 200 and an XML ServiceException
  if (!res.ok || !(res.headers.get('content-type') ?? '').startsWith('image/')) return null
  return Buffer.from(await res.arrayBuffer())
}

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const year = String(query.year ?? '')
  const [z, x, y] = [query.z, query.x, query.y].map(Number) as [number, number, number]
  const valid = YEARS.has(year) && Number.isInteger(z) && Number.isInteger(x) && Number.isInteger(y)
    && z >= 0 && z <= 20 && x >= 0 && y >= 0 && x < 2 ** z && y < 2 ** z
  if (!valid) throw createError({ statusCode: 400, statusMessage: 'year, z, x, y required' })

  const png = await archived(`ortho:${year}:${z}:${x}:${y}.png`, async () => {
    // Some detailed 2007 tiles fail upstream ("no image returned from source WMS")
    // but render when asked for fewer pixels; in that case upscale back to 256 px.
    for (const px of [256, 128, 64]) {
      const tile = await fetchWms(year, tileBbox(z, x, y), px)
      if (!tile) continue
      return px === 256 ? tile : sharp(tile).resize(256, 256, { kernel: 'cubic' }).png().toBuffer()
    }
    throw createError({ statusCode: 502, statusMessage: 'Orthophoto service unavailable' })
  })
  setHeader(event, 'Content-Type', 'image/png')
  setHeader(event, 'Cache-Control', 'public, max-age=604800')
  return png
})
