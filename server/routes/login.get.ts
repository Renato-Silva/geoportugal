/** GET /login — minimal standalone sign-in page (the SPA itself is behind the password). */
export default defineEventHandler((event) => {
  const { sitePassword } = useRuntimeConfig(event)
  const query = getQuery(event)
  const next = safeNext(query.next)
  if (!sitePassword || hasSiteSession(event, sitePassword)) return sendRedirect(event, next)

  const escapedNext = next.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
  const error = query.error ? '<p class="error" role="alert">Palavra-passe incorreta.</p>' : ''
  setHeader(event, 'Content-Type', 'text/html; charset=utf-8')
  setHeader(event, 'Cache-Control', 'no-store')
  return `<!doctype html>
<html lang="pt">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>GeoPortugal — Entrar</title>
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600&display=swap">
<style>
  :root { --paper:#f5f6f8; --card:#fff; --ink:#0f1115; --ink-2:#4b5563; --rule:#e3e6eb; --accent:#1f6fff; --error:#d92d20;
    --shadow:0 1px 2px rgb(15 17 21/.06),0 12px 32px -12px rgb(15 17 21/.18); color-scheme:light; }
  @media (prefers-color-scheme: dark) {
    :root { --paper:#0c0d10; --card:#15171b; --ink:#f2f4f7; --ink-2:#a9b0bc; --rule:#262930; --accent:#4c8dff; --error:#f97066;
      --shadow:0 1px 2px rgb(0 0 0/.4),0 16px 40px -12px rgb(0 0 0/.6); color-scheme:dark; }
  }
  * { box-sizing:border-box; }
  body { margin:0; min-height:100dvh; display:grid; place-items:center; padding:16px;
    background:var(--paper); color:var(--ink); font:15px/1.5 Geist,system-ui,sans-serif; }
  form { width:100%; max-width:340px; background:var(--card); border:1px solid var(--rule); border-radius:14px;
    padding:28px; box-shadow:var(--shadow); display:grid; gap:14px; }
  h1 { margin:0 0 4px; font-size:18px; font-weight:600; display:flex; align-items:center; gap:10px; }
  h1 img { width:22px; height:22px; }
  label { font-size:13px; font-weight:500; color:var(--ink-2); display:grid; gap:6px; }
  input { font:inherit; color:inherit; background:transparent; border:1px solid var(--rule); border-radius:9px; padding:9px 12px; }
  input:focus { outline:2px solid var(--accent); outline-offset:-1px; border-color:transparent; }
  button { font:inherit; font-weight:500; border:0; border-radius:9px; padding:10px; background:var(--accent); color:#fff; cursor:pointer; }
  button:hover { filter:brightness(1.08); }
  .error { margin:0; color:var(--error); font-size:13px; }
</style>
</head>
<body>
<form method="post" action="/login">
  <h1><img src="/favicon.svg" alt="">GeoPortugal</h1>
  <label>Palavra-passe
    <input type="password" name="password" autocomplete="current-password" required autofocus>
  </label>
  ${error}
  <input type="hidden" name="next" value="${escapedNext}">
  <button type="submit">Entrar</button>
</form>
</body>
</html>`
})
