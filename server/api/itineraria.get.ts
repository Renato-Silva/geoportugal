import { archived } from '../utils/archive'

/**
 * GET /api/itineraria?z&x&y — CIGeoE's "Carta Militar Itinerária" (1:500 000, 2014)
 * as XYZ tiles. The WMS sends no CORS headers, so it is proxied, and tiles are kept
 * in the archive after the first fetch (PNG passthrough).
 */
const WMS = 'https://webservices.igeoe.pt/geoserver/wms'
const HALF = 20037508.342789244

export default defineEventHandler(async (event) => {
  const { z, x, y } = getQuery(event)
  const [Z, X, Y] = [z, x, y].map(Number) as [number, number, number]
  const valid = [Z, X, Y].every(Number.isInteger) && Z >= 5 && Z <= 13 && X >= 0 && Y >= 0 && X < 2 ** Z && Y < 2 ** Z
  if (!valid) throw createError({ statusCode: 400, statusMessage: 'z (5–13), x, y required' })

  const png = await archived(`itineraria:${Z}:${X}:${Y}.png`, async () => {
    const size = (2 * HALF) / 2 ** Z
    const minx = -HALF + X * size, maxy = HALF - Y * size
    const url = `${WMS}?service=WMS&version=1.1.1&request=GetMap&layers=cigeoe:carta_itineraria&styles=`
      + `&srs=EPSG:3857&bbox=${minx},${maxy - size},${minx + size},${maxy}&width=256&height=256&format=image/png&transparent=true`
    const res = await fetch(url, { signal: AbortSignal.timeout(30_000) })
    if (!res.ok || !(res.headers.get('content-type') ?? '').startsWith('image/'))
      throw createError({ statusCode: 502, statusMessage: 'CIGeoE map service unavailable' })
    return Buffer.from(await res.arrayBuffer())
  })
  setHeader(event, 'Content-Type', 'image/png')
  setHeader(event, 'Cache-Control', 'public, max-age=604800')
  return png
})
