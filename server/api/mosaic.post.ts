import JSZip from 'jszip'
import sharp from 'sharp'
import { bboxTo3857, type Bbox4326, GEOREF_README_PT, sidecars, worldFile } from '#shared/georef'
import { fetchOriginal, photoVariant, validatePhotoId } from '../utils/photo'

/**
 * POST /api/mosaic  { photos: [{ rolo, foto, bbox: [w,s,e,n] }], name? }
 * → ZIP with one georeferenced PNG (EPSG:3857) of all photos laid out together,
 *   film borders trimmed so overlaps blend.
 */
const MAX_PHOTOS = 60
const MAX_SIDE = 7000

interface Input { rolo: string, foto: string, bbox: Bbox4326 }

export default defineEventHandler(async (event) => {
  const body = await readBody<{ photos?: Input[], name?: string }>(event)
  const photos = body?.photos ?? []
  if (!Array.isArray(photos) || !photos.length || photos.length > MAX_PHOTOS)
    throw createError({ statusCode: 400, statusMessage: `1–${MAX_PHOTOS} photos required` })
  for (const p of photos) {
    validatePhotoId(String(p.rolo), String(p.foto))
    if (!Array.isArray(p.bbox) || p.bbox.length !== 4 || !p.bbox.every(Number.isFinite))
      throw createError({ statusCode: 400, statusMessage: 'Invalid bbox' })
  }

  // Extent and resolution: keep the finest native pixel size, capped by the output size.
  const items = await Promise.all(photos.map(async (p) => {
    const ext = bboxTo3857(p.bbox)
    const meta = await sharp(await fetchOriginal(p.rolo, p.foto)).metadata()
    return { ...p, ext, res: (ext[2] - ext[0]) / (meta.width ?? 1000) }
  }))
  const X0 = Math.min(...items.map(i => i.ext[0])), Y0 = Math.min(...items.map(i => i.ext[1]))
  const X1 = Math.max(...items.map(i => i.ext[2])), Y1 = Math.max(...items.map(i => i.ext[3]))
  let res = Math.min(...items.map(i => i.res))
  res = Math.max(res, (X1 - X0) / MAX_SIDE, (Y1 - Y0) / MAX_SIDE)
  const width = Math.ceil((X1 - X0) / res), height = Math.ceil((Y1 - Y0) / res)

  const layers = await Promise.all(items.map(async (i) => {
    const w = Math.max(1, Math.round((i.ext[2] - i.ext[0]) / res))
    const h = Math.max(1, Math.round((i.ext[3] - i.ext[1]) / res))
    const img = await photoVariant(i.rolo, i.foto, { size: 'full', trim: 0.1 })
    return {
      input: await sharp(img).resize(w, h, { fit: 'fill' }).png().toBuffer(),
      left: Math.round((i.ext[0] - X0) / res),
      top: Math.round((Y1 - i.ext[3]) / res),
    }
  }))

  const png = await sharp({ create: { width, height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } }, limitInputPixels: false })
    .composite(layers)
    .toColourspace('b-w')
    .png({ compressionLevel: 6 })
    .toBuffer()

  const name = (body?.name || 'geoportugal_mosaico').replace(/[^\w.-]+/g, '-').slice(0, 80)
  const zip = new JSZip()
  zip.file(`${name}.png`, png)
  for (const [file, text] of Object.entries(sidecars(name, worldFile(X0, Y1, res, res)))) zip.file(file, text)
  zip.file('LEIA-ME.txt', `${GEOREF_README_PT}\nFotografias / photos: ${photos.map(p => `${p.rolo}/${p.foto}`).join(', ')}\nResolução / pixel size: ${res.toFixed(2)} m (EPSG:3857)\n\n© DGT — Direção-Geral do Território\n`)

  setHeader(event, 'Content-Type', 'application/zip')
  setHeader(event, 'Content-Disposition', `attachment; filename="${name}.zip"`)
  return zip.generateAsync({ type: 'nodebuffer', compression: 'STORE' })
})
