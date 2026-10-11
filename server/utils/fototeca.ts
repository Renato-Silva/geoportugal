// Thin client for the legacy DGT Fototeca endpoints (geo5), which send no CORS headers.

export type Bbox = [number, number, number, number]

export const DECADES = [194, 195, 196, 197, 198, 199, 200] as const

export function fototecaBase() {
  return useRuntimeConfig().fototecaBase as string
}

export function parseBboxParam(raw: unknown): Bbox {
  const parts = String(raw ?? '').split(',').map(Number)
  const valid = parts.length === 4 && parts.every(Number.isFinite)
    && parts[0]! < parts[2]! && parts[1]! < parts[3]!
    && parts[0]! >= -180 && parts[2]! <= 180 && parts[1]! >= -90 && parts[3]! <= 90
  if (!valid) throw createError({ statusCode: 400, statusMessage: 'bbox must be minLon,minLat,maxLon,maxLat' })
  return parts as Bbox
}

// Upstream is an old Windows box; keep the number of simultaneous requests modest.
const MAX_CONCURRENT = 6
let active = 0
const waiting: Array<() => void> = []

export async function limited<T>(task: () => Promise<T>): Promise<T> {
  if (active >= MAX_CONCURRENT) await new Promise<void>(resolve => waiting.push(resolve))
  active++
  try {
    return await task()
  }
  finally {
    active--
    waiting.shift()?.()
  }
}

/** Fetch a JSON endpoint that is served as text/html. */
export async function fetchLegacyJson<T>(path: string, query: Record<string, string>): Promise<T> {
  const text = await limited(() => $fetch<string>(`${fototecaBase()}/${path}`, {
    query,
    responseType: 'text',
    timeout: 20_000,
    retry: 1,
  }))
  try {
    return JSON.parse(text) as T
  }
  catch {
    throw createError({ statusCode: 502, statusMessage: `Unexpected response from Fototeca (${path})` })
  }
}
