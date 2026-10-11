import sharp, { type Sharp } from 'sharp'
import { fototecaBase, limited } from './fototeca'
import { archived, keyPart } from './archive'

const ROLO_RE = /^[\w./-]{1,24}$/
const FOTO_RE = /^\w{1,12}$/

export function validatePhotoId(rolo: string, foto: string) {
  if (!ROLO_RE.test(rolo) || !FOTO_RE.test(foto))
    throw createError({ statusCode: 400, statusMessage: 'Invalid roll/frame number' })
}

/** The upstream PNG for a frame — fetched from DGT once, then served from the archive. */
export function fetchOriginal(rolo: string, foto: string): Promise<Buffer> {
  return archived(`photos:${keyPart(rolo)}:${keyPart(foto)}:original.png`, () => limited(async () => {
    const res = await fetch(`${fototecaBase()}/imagem?NUMROLO=${encodeURIComponent(rolo)}&NUMFOTO=${encodeURIComponent(foto)}`, {
      signal: AbortSignal.timeout(45_000),
    })
    const type = res.headers.get('content-type') ?? ''
    if (!res.ok || !type.startsWith('image/'))
      throw createError({ statusCode: 404, statusMessage: 'Photo not available' })
    return Buffer.from(await res.arrayBuffer())
  }))
}

type Pt = [number, number]

/**
 * The upstream PNG is the film frame rotated north-up inside a transparent square.
 * Find the frame's four corners from the alpha channel, so we can mask off the
 * dark film border (fiducials, edge annotations) when photos are mosaicked.
 */
async function frameCorners(img: Sharp): Promise<Pt[] | null> {
  const { data, info } = await img.clone().ensureAlpha().extractChannel('alpha').raw()
    .toBuffer({ resolveWithObject: true })
  const { width: w, height: h } = info
  // Candidate set A: extremes along the axes (good for rotated frames).
  let top: Pt | null = null, bottom: Pt | null = null, left: Pt | null = null, right: Pt | null = null
  // Candidate set B: extremes along the diagonals (good for near-axis-aligned frames).
  let minSum: Pt | null = null, maxSum: Pt | null = null, minDiff: Pt | null = null, maxDiff: Pt | null = null
  for (let y = 0; y < h; y++) {
    const row = y * w
    for (let x = 0; x < w; x++) {
      if (data[row + x]! < 128) continue
      if (!top) top = [x, y]
      bottom = [x, y]
      if (!left || x < left[0]) left = [x, y]
      if (!right || x > right[0]) right = [x, y]
      const s = x + y, d = x - y
      if (!minSum || s < minSum[0] + minSum[1]) minSum = [x, y]
      if (!maxSum || s > maxSum[0] + maxSum[1]) maxSum = [x, y]
      if (!minDiff || d < minDiff[0] - minDiff[1]) minDiff = [x, y]
      if (!maxDiff || d > maxDiff[0] - maxDiff[1]) maxDiff = [x, y]
    }
  }
  if (!top || !bottom || !left || !right) return null
  const area = (p: Pt[]) => Math.abs(p.reduce((acc, a, i) => {
    const b = p[(i + 1) % p.length]!
    return acc + a[0] * b[1] - b[0] * a[1]
  }, 0)) / 2
  const a: Pt[] = [top, right, bottom, left]
  const b: Pt[] = [minSum!, maxDiff!, maxSum!, minDiff!]
  return area(a) >= area(b) ? a : b
}

/** WebP variant (thumbnail / map overlay), rendered once and kept in the archive. */
export function photoVariant(rolo: string, foto: string, opts: { size: 'thumb' | 'full', trim: number }) {
  const key = `photos:${keyPart(rolo)}:${keyPart(foto)}:${opts.size}${opts.trim ? `-trim${opts.trim}` : ''}.webp`
  return archived(key, async () => renderPhoto(await fetchOriginal(rolo, foto), opts))
}

async function renderPhoto(original: Buffer, opts: { size: 'thumb' | 'full', trim: number }) {
  let img = sharp(original)
  if (opts.trim > 0) {
    const corners = await frameCorners(img)
    if (corners) {
      const { width, height } = await img.metadata()
      const cx = corners.reduce((s, p) => s + p[0], 0) / 4
      const cy = corners.reduce((s, p) => s + p[1], 0) / 4
      const shrunk = corners.map(([x, y]) => [cx + (x - cx) * (1 - opts.trim), cy + (y - cy) * (1 - opts.trim)])
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">`
        + `<polygon points="${shrunk.map(p => p.join(',')).join(' ')}" fill="#fff"/></svg>`
      const masked = await img.ensureAlpha()
        .composite([{ input: Buffer.from(svg), blend: 'dest-in' }])
        .png().toBuffer()
      img = sharp(masked)
    }
  }
  if (opts.size === 'thumb') img = img.resize({ width: 360, height: 360, fit: 'inside' })
  return img.webp({ quality: opts.size === 'thumb' ? 70 : 85, alphaQuality: 90 }).toBuffer()
}
