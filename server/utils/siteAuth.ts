import { createHmac, timingSafeEqual } from 'node:crypto'
import type { H3Event } from 'h3'

export const SITE_AUTH_COOKIE = 'gp_auth'

/** Session token derived from the password: changing the password signs everyone out. */
export const siteAuthToken = (password: string) =>
  createHmac('sha256', password).update('geoportugal-site-auth').digest('base64url')

const safeEqual = (a: string, b: string) => {
  const [x, y] = [Buffer.from(a), Buffer.from(b)]
  return x.length === y.length && timingSafeEqual(x, y)
}

export const checkSitePassword = (given: string, password: string) => safeEqual(given, password)

export const hasSiteSession = (event: H3Event, password: string) =>
  safeEqual(getCookie(event, SITE_AUTH_COOKIE) ?? '', siteAuthToken(password))

/** Only same-site relative paths, so ?next= can't redirect elsewhere. */
export const safeNext = (next: unknown) =>
  typeof next === 'string' && next.startsWith('/') && !next.startsWith('//') ? next : '/'
