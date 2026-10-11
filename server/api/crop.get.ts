import sharp from 'sharp'
import { bboxTo3857, type Bbox4326 } from '#shared/georef'
import { archived, keyPart } from '../utils/archive'
import { cropKey, readCropParams, window3857 } from '../utils/crop'
import { photoVariant, validatePhotoId } from '../utils/photo'

/**
 * GET /api/crop?rolo&foto&bbox=w,s,e,n&lon&lat&m=600&px=512
 *
 * A square window of `m` metres around a point, cut from a historical photo
 * (film border trimmed). The photo is assumed to span its footprint bbox
 * linearly in Web Mercator, as on the map. Parts outside the photo are transparent.
 */
export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const rolo = String(query.rolo ?? ''), foto = String(query.foto ?? '')
  validatePhotoId(rolo, foto)
  const bbox = String(query.bbox ?? '').split(',').map(Number) as Bbox4326
  if (bbox.length !== 4 || !bbox.every(Number.isFinite))
    throw createError({ statusCode: 400, statusMessage: 'bbox required' })
  const params = readCropParams(query)

  const webp = await archived(`crops:${keyPart(rolo)}:${keyPart(foto)}:${cropKey(params)}.webp`, async () => {
    const full = await photoVariant(rolo, foto, { size: 'full', trim: 0.1 })
    const { width: W = 0, height: H = 0 } = await sharp(full).metadata()
    const [x0, , x1, y1] = bboxTo3857(bbox)
    const y0 = bboxTo3857(bbox)[1]
    const sx = W / (x1 - x0), sy = H / (y1 - y0)
    const [wx0, wy0, wx1, wy1] = window3857(params)
    const left = Math.round((wx0 - x0) * sx), top = Math.round((y1 - wy1) * sy)
    const w = Math.max(1, Math.round((wx1 - wx0) * sx)), h = Math.max(1, Math.round((wy1 - wy0) * sy))
    const ix0 = Math.max(0, left), iy0 = Math.max(0, top)
    const ix1 = Math.min(W, left + w), iy1 = Math.min(H, top + h)
    if (ix1 <= ix0 || iy1 <= iy0) throw createError({ statusCode: 404, statusMessage: 'Point is outside this photo' })
    const piece = await sharp(full)
      .extract({ left: ix0, top: iy0, width: ix1 - ix0, height: iy1 - iy0 })
      .extend({
        left: ix0 - left, top: iy0 - top, right: left + w - ix1, bottom: top + h - iy1,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png()
      .toBuffer()
    return sharp(piece).resize(params.px, params.px, { fit: 'fill' }).webp({ quality: 84, alphaQuality: 90 }).toBuffer()
  })

  setHeader(event, 'Content-Type', 'image/webp')
  setHeader(event, 'Cache-Control', 'public, max-age=2592000, immutable')
  return webp
})
