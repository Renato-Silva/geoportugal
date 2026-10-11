/**
 * Optional password protection, enabled only when NUXT_SITE_PASSWORD is set.
 * Pages redirect to /login; API calls without a session get a plain 401.
 */
export default defineEventHandler((event) => {
  const { sitePassword } = useRuntimeConfig(event)
  if (!sitePassword) return

  const path = event.path.split('?')[0]!
  if (path === '/login' || path.startsWith('/_nuxt/') || path === '/favicon.svg') return
  if (hasSiteSession(event, sitePassword)) return

  if (path.startsWith('/api/'))
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  return sendRedirect(event, `/login?next=${encodeURIComponent(event.path)}`)
})
