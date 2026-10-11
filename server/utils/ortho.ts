import sharp from 'sharp'

// DGT orthophoto WMS services. Years with a public WMS; 2023 is the satellite orthomosaic.
// The 1995 and coastal 2014–15 services group their images with a red sheet grid,
// so the image layers are named directly. They also stop drawing (plain white) above
// ~9.6 m/px (coarser than z14) and are white where they have no imagery, hence
// `maxRes` and `transparent`.
interface OrthoSource { url: string, layer: string, maxRes?: number, transparent?: boolean }
const ZOOMED_OUT_LIMIT = { maxRes: 9.6, transparent: true }

export const ORTHO_SOURCES: Record<string, OrthoSource> = {
  1995: { url: 'https://cartografia.dgterritorio.gov.pt/wms/ortos1995', layer: 'Ortos1995-FalsaCor', ...ZOOMED_OUT_LIMIT },
  ...Object.fromEntries(['2007', '2010', '2012', '2015', '2018', '2021'].map(y => [y, {
    url: `https://cartografia.dgterritorio.gov.pt/ortos${y}/service`,
    layer: `DGT_Ortos${y}`,
  }])),
  2014: {
    url: 'https://cartografia.dgterritorio.gov.pt/wms/ortos2014-2015-litoral',
    layer: ['A', 'B', 'C', 'D'].map(l => `Lote${l}\\42\\Ortos2014-${l}`).join(','),
    ...ZOOMED_OUT_LIMIT,
  },
  2023: { url: 'https://ortos.dgterritorio.gov.pt/wms/ortosat2023', layer: 'ortoSat2023-CorVerdadeira' },
}

async function getMap(year: string, bbox3857: number[], px: number): Promise<Buffer | null> {
  const src = ORTHO_SOURCES[year]!
  const url = `${src.url}?service=WMS&version=1.1.1&request=GetMap`
    + `&layers=${encodeURIComponent(src.layer)}&styles=&srs=EPSG:3857&bbox=${bbox3857.join(',')}&width=${px}&height=${px}&format=image/png${src.transparent ? '&transparent=true' : ''}`
  const res = await fetch(url, { signal: AbortSignal.timeout(60_000) })
  // The WMS answers errors with HTTP 200 and an XML ServiceException
  if (!res.ok || !(res.headers.get('content-type') ?? '').startsWith('image/')) return null
  return Buffer.from(await res.arrayBuffer())
}

/** Largest image fetched to render a zoomed-out view of a `maxRes` source. */
const MAX_FETCH_PX = 2048

/**
 * A square PNG of the given 3857 bbox. Some detailed 2007 areas fail upstream
 * ("no image returned from source WMS") but render when asked for fewer pixels,
 * in which case the result is upscaled back to the requested size. Sources with
 * a `maxRes` are fetched at that resolution and scaled down.
 */
export async function orthoImage(year: string, bbox3857: number[], px: number): Promise<Buffer> {
  const { maxRes } = ORTHO_SOURCES[year]!
  const need = maxRes ? Math.ceil((bbox3857[2]! - bbox3857[0]!) / maxRes) : 0
  if (need > px) {
    if (need > MAX_FETCH_PX) throw createError({ statusCode: 400, statusMessage: `The ${year} orthophotos are not shown this far out` })
    const img = await getMap(year, bbox3857, need)
    if (!img) throw createError({ statusCode: 502, statusMessage: 'Orthophoto service unavailable' })
    return sharp(img).resize(px, px, { kernel: 'lanczos3' }).png().toBuffer()
  }
  for (const size of [px, Math.round(px / 2), Math.round(px / 4)]) {
    const img = await getMap(year, bbox3857, size)
    if (!img) continue
    return size === px ? img : sharp(img).resize(px, px, { kernel: 'cubic' }).png().toBuffer()
  }
  throw createError({ statusCode: 502, statusMessage: 'Orthophoto service unavailable' })
}
