import { archived } from '../utils/archive'
import { cropKey, readCropParams, window3857 } from '../utils/crop'
import { ORTHO_SOURCES, orthoImage } from '../utils/ortho'

/** GET /api/ortho-crop?year&lon&lat&m=600&px=512 — the same window from an orthophoto year (PNG). */
export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const year = String(query.year ?? '')
  if (!(year in ORTHO_SOURCES)) throw createError({ statusCode: 400, statusMessage: 'Unknown year' })
  const params = readCropParams(query)
  const png = await archived(`ortho-crops:${year}:${cropKey(params)}.png`, () => orthoImage(year, window3857(params), params.px))
  setHeader(event, 'Content-Type', 'image/png')
  setHeader(event, 'Cache-Control', 'public, max-age=604800')
  return png
})
