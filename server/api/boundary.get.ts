import { fetchBoundary, isAdminLevel } from '../utils/caop'

/** GET /api/boundary?level=district|municipality|parish&code=… */
export default defineCachedEventHandler(async (event) => {
  const { level, code } = getQuery(event)
  if (!isAdminLevel(level) || typeof code !== 'string' || !/^\d{2,6}$/.test(code))
    throw createError({ statusCode: 400, statusMessage: 'level and code required' })
  const boundary = await fetchBoundary(level, code)
  if (!boundary) throw createError({ statusCode: 404, statusMessage: 'Boundary not found' })
  return boundary
}, {
  maxAge: 60 * 60 * 24 * 7,
  name: 'boundary',
  getKey: event => `${getQuery(event).level}:${getQuery(event).code}`,
})
