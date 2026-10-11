import { fetchOriginal, photoVariant, validatePhotoId } from '../utils/photo'

/**
 * GET /api/photo?rolo=…&foto=…
 *   &size=thumb|full|original  (default full)
 *   &trim=0..0.15              mask off the film border (full/thumb only)
 *   &download=1                send as attachment
 *
 * Roll numbers look like "87.23" or "164/74", so they travel as a query parameter.
 */
export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const rolo = String(query.rolo ?? '')
  const foto = String(query.foto ?? '')
  validatePhotoId(rolo, foto)

  const size = ['thumb', 'full', 'original'].includes(String(query.size)) ? String(query.size) : 'full'
  const trim = Math.min(Math.max(Number(query.trim) || 0, 0), 0.15)

  const name = `geoportugal_${rolo.replace(/[^\w]+/g, '-')}_${foto}`

  setHeader(event, 'Cache-Control', 'public, max-age=2592000, immutable')
  if (query.download)
    setHeader(event, 'Content-Disposition', `attachment; filename="${name}.${size === 'original' ? 'png' : 'webp'}"`)

  if (size === 'original') {
    const original = await fetchOriginal(rolo, foto)
    setHeader(event, 'Content-Type', 'image/png')
    return original
  }
  const variant = await photoVariant(rolo, foto, { size: size as 'thumb' | 'full', trim })
  setHeader(event, 'Content-Type', 'image/webp')
  return variant
})
