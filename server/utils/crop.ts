import { to3857 } from '#shared/georef'

export interface CropParams {
  lon: number
  lat: number
  /** ground size of the square window, metres */
  m: number
  /** output size, pixels */
  px: number
}

/** Shared validation for the time-lapse crop routes. */
export function readCropParams(query: Record<string, unknown>): CropParams {
  const lon = Number(query.lon), lat = Number(query.lat)
  const m = Math.round(Number(query.m) || 600)
  const px = Math.round(Number(query.px) || 512)
  if (!Number.isFinite(lon) || !Number.isFinite(lat) || Math.abs(lon) > 180 || Math.abs(lat) > 85)
    throw createError({ statusCode: 400, statusMessage: 'lon and lat required' })
  if (m < 100 || m > 5000 || px < 64 || px > 1024)
    throw createError({ statusCode: 400, statusMessage: 'm must be 100–5000, px 64–1024' })
  return { lon, lat, m, px }
}

/** Square window around a point in EPSG:3857 covering `m` metres on the ground. */
export function window3857({ lon, lat, m }: CropParams): [number, number, number, number] {
  const [x, y] = to3857(lon, lat)
  const half = m / 2 / Math.cos(lat * Math.PI / 180) // Mercator stretches with latitude
  return [x - half, y - half, x + half, y + half]
}

export const cropKey = ({ lon, lat, m, px }: CropParams) => `${lon.toFixed(5)}:${lat.toFixed(5)}:${m}:${px}`
