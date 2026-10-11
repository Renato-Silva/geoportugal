import sharp from 'sharp'

// DGT orthophoto WMS services. Years with a public WMS; 2023 is the satellite orthomosaic.
export const ORTHO_SOURCES: Record<string, { url: string, layer: string }> = {
  ...Object.fromEntries(['2007', '2010', '2012', '2015', '2018', '2021'].map(y => [y, {
    url: `https://cartografia.dgterritorio.gov.pt/ortos${y}/service`,
    layer: `DGT_Ortos${y}`,
  }])),
  2023: { url: 'https://ortos.dgterritorio.gov.pt/wms/ortosat2023', layer: 'ortoSat2023-CorVerdadeira' },
}

async function getMap(year: string, bbox3857: number[], px: number): Promise<Buffer | null> {
  const src = ORTHO_SOURCES[year]!
  const url = `${src.url}?service=WMS&version=1.1.1&request=GetMap`
    + `&layers=${src.layer}&styles=&srs=EPSG:3857&bbox=${bbox3857.join(',')}&width=${px}&height=${px}&format=image/png`
  const res = await fetch(url, { signal: AbortSignal.timeout(30_000) })
  // The WMS answers errors with HTTP 200 and an XML ServiceException
  if (!res.ok || !(res.headers.get('content-type') ?? '').startsWith('image/')) return null
  return Buffer.from(await res.arrayBuffer())
}

/**
 * A square PNG of the given 3857 bbox. Some detailed 2007 areas fail upstream
 * ("no image returned from source WMS") but render when asked for fewer pixels,
 * in which case the result is upscaled back to the requested size.
 */
export async function orthoImage(year: string, bbox3857: number[], px: number): Promise<Buffer> {
  for (const size of [px, Math.round(px / 2), Math.round(px / 4)]) {
    const img = await getMap(year, bbox3857, size)
    if (!img) continue
    return size === px ? img : sharp(img).resize(px, px, { kernel: 'cubic' }).png().toBuffer()
  }
  throw createError({ statusCode: 502, statusMessage: 'Orthophoto service unavailable' })
}
