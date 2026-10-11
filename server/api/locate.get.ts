import { locatePoint } from '../utils/caop'

/** GET /api/locate?lon=…&lat=… — parish / municipality / district containing a point. */
export default defineCachedEventHandler(async (event) => {
  const lon = Number(getQuery(event).lon), lat = Number(getQuery(event).lat)
  if (!Number.isFinite(lon) || !Number.isFinite(lat) || Math.abs(lon) > 180 || Math.abs(lat) > 90)
    throw createError({ statusCode: 400, statusMessage: 'lon and lat required' })
  return locatePoint(lon, lat)
}, {
  maxAge: 60 * 60 * 24 * 30,
  name: 'locate',
  getKey: event => `${Number(getQuery(event).lon).toFixed(4)},${Number(getQuery(event).lat).toFixed(4)}`,
})
