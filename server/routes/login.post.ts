/** POST /login — checks the site password and sets the session cookie. */
export default defineEventHandler(async (event) => {
  const { sitePassword } = useRuntimeConfig(event)
  const body = await readBody<{ password?: string, next?: string }>(event)
  const next = safeNext(body?.next)
  if (!sitePassword) return sendRedirect(event, next, 303)

  if (!checkSitePassword(String(body?.password ?? ''), sitePassword))
    return sendRedirect(event, `/login?error=1&next=${encodeURIComponent(next)}`, 303)

  setCookie(event, SITE_AUTH_COOKIE, siteAuthToken(sitePassword), {
    httpOnly: true,
    sameSite: 'lax',
    secure: getRequestProtocol(event) === 'https',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  })
  return sendRedirect(event, next, 303)
})
