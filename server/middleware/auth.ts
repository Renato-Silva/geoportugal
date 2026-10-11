import { timingSafeEqual } from 'node:crypto'

/**
 * Optional password protection (HTTP Basic auth), enabled only when
 * NUXT_SITE_PASSWORD is set. Any username is accepted.
 */
export default defineEventHandler((event) => {
  const { sitePassword } = useRuntimeConfig(event)
  if (!sitePassword) return

  const header = getRequestHeader(event, 'authorization') ?? ''
  const [scheme, encoded] = header.split(' ')
  if (scheme?.toLowerCase() === 'basic' && encoded) {
    const decoded = Buffer.from(encoded, 'base64').toString()
    const given = Buffer.from(decoded.slice(decoded.indexOf(':') + 1))
    const expected = Buffer.from(String(sitePassword))
    if (given.length === expected.length && timingSafeEqual(given, expected)) return
  }

  setResponseHeader(event, 'WWW-Authenticate', 'Basic realm="GeoPortugal", charset="UTF-8"')
  throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
})
