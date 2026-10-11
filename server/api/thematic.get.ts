import { archived } from '../utils/archive'
import { isThematicId, THEMATIC_LAYERS, thematicWms } from '#shared/thematic'

/**
 * GET /api/thematic?id=maf&z&x&y — DGT thematic maps (MAF 1951–80, COS land use)
 * as XYZ tiles. GeoServer renders these vector layers slowly (several seconds a
 * tile for MAF), so tiles are kept in the archive after the first fetch.
 */
const HALF = 20037508.342789244

export default defineEventHandler(async (event) => {
  const { id, z, x, y } = getQuery(event)
  const [Z, X, Y] = [z, x, y].map(Number) as [number, number, number]
  const valid = isThematicId(id) && [Z, X, Y].every(Number.isInteger)
    && Z >= 6 && Z <= 16 && X >= 0 && Y >= 0 && X < 2 ** Z && Y < 2 ** Z
  if (!valid) throw createError({ statusCode: 400, statusMessage: 'id, z (6–16), x, y required' })

  const png = await archived(`thematic:${id}:${Z}:${X}:${Y}.png`, async () => {
    const size = (2 * HALF) / 2 ** Z
    const minx = -HALF + X * size, maxy = HALF - Y * size
    const url = `${thematicWms(id)}?service=WMS&version=1.1.1&request=GetMap&layers=${THEMATIC_LAYERS[id].layer}&styles=`
      + `&srs=EPSG:3857&bbox=${minx},${maxy - size},${minx + size},${maxy}&width=256&height=256&format=image/png&transparent=true`
    const res = await fetch(url, { signal: AbortSignal.timeout(60_000) })
    if (!res.ok || !(res.headers.get('content-type') ?? '').startsWith('image/'))
      throw createError({ statusCode: 502, statusMessage: 'DGT map service unavailable' })
    return Buffer.from(await res.arrayBuffer())
  })
  setHeader(event, 'Content-Type', 'image/png')
  setHeader(event, 'Cache-Control', 'public, max-age=604800')
  return png
})
