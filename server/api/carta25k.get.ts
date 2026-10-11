import { archived } from '../utils/archive'

/**
 * GET /api/carta25k?z&x&y — licensed Carta Militar 1:25 000 tiles (CIGeoE).
 *
 * The upstream service is a paid, key-protected WMTS. Nothing here embeds a key:
 * the URL template and token come from runtime config, which the operator fills in
 * after obtaining a CIGeoE web-use licence. The token stays server-side.
 */
export default defineEventHandler(async (event) => {
  const cfg = useRuntimeConfig().cartaMilitar as { url: string, token: string, header: string }
  if (!cfg.url)
    throw createError({ statusCode: 503, statusMessage: 'Carta Militar 1:25 000 is not configured' })

  const { z, x, y } = getQuery(event)
  const [Z, X, Y] = [z, x, y].map(Number) as [number, number, number]
  const valid = [Z, X, Y].every(Number.isInteger) && Z >= 0 && Z <= 20 && X >= 0 && Y >= 0 && X < 2 ** Z && Y < 2 ** Z
  if (!valid) throw createError({ statusCode: 400, statusMessage: 'z, x, y required' })

  const png = await archived(`carta25k:${Z}:${X}:${Y}.png`, async () => {
    const url = cfg.url
      .replace('{z}', String(Z)).replace('{x}', String(X)).replace('{y}', String(Y))
      .replace('{token}', encodeURIComponent(cfg.token))
    const headers: Record<string, string> = {}
    if (cfg.header) {
      const i = cfg.header.indexOf(':')
      if (i > 0) headers[cfg.header.slice(0, i).trim()] = cfg.header.slice(i + 1).trim()
    }
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(30_000) })
    if (!res.ok || !(res.headers.get('content-type') ?? '').startsWith('image/'))
      throw createError({ statusCode: 502, statusMessage: `Carta Militar tile unavailable (${res.status})` })
    return Buffer.from(await res.arrayBuffer())
  })
  setHeader(event, 'Content-Type', 'image/png')
  setHeader(event, 'Cache-Control', 'public, max-age=604800')
  return png
})
