import tailwindcss from '@tailwindcss/vite'

export default defineNuxtConfig({
  compatibilityDate: '2026-10-01',
  ssr: false,
  devtools: { enabled: false },
  css: ['maplibre-gl/dist/maplibre-gl.css', '~/assets/css/main.css'],
  vite: {
    plugins: [tailwindcss()],
    // MapLibre 6 resolves its worker module relative to its own file; pre-bundling breaks that.
    optimizeDeps: { exclude: ['maplibre-gl'], include: ['jszip'] },
  },
  app: {
    head: {
      title: 'GeoPortugal — Fotografia aérea histórica de Portugal',
      htmlAttrs: { lang: 'pt' },
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'description', content: 'Explore 122 mil fotografias aéreas históricas de Portugal (1944–2000) do arquivo da DGT.' },
      ],
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Geist+Mono:wght@400;500&display=swap' },
      ],
    },
  },
  runtimeConfig: {
    fototecaBase: 'https://geo5.dgterritorio.gov.pt/fototeca',
    // Optional S3-compatible storage for fetched imagery (NUXT_S3_BUCKET, NUXT_S3_REGION, …).
    // When empty, imagery is stored on local disk in archiveDir (NUXT_ARCHIVE_DIR).
    archiveDir: '.data/archive',
    // Password-protects the whole site (HTTP Basic auth) when set (NUXT_SITE_PASSWORD).
    sitePassword: '',
    s3: {
      bucket: '',
      region: '',
      endpoint: '',
      accessKeyId: '',
      secretAccessKey: '',
    },
    // Licensed Carta Militar 1:25 000 tiles (CIGeoE). Configure once you hold a licence:
    //   NUXT_CARTA_MILITAR_URL  — tile template, with {z}/{x}/{y} and optionally {token}
    //       e.g. https://…/WMTS/tile/1.0.0/mobile_25k/default/GoogleMapsCompatible/{z}/{y}/{x}?token={token}
    //   NUXT_CARTA_MILITAR_TOKEN   — the key/token (kept server-side; never sent to the browser)
    //   NUXT_CARTA_MILITAR_HEADER  — optional "Name: value" header for auth instead of a {token} in the URL
    cartaMilitar: {
      url: '',
      token: '',
      header: '',
    },
    public: {
      // Set NUXT_PUBLIC_CARTA_MILITAR_ENABLED=true to show the basemap once licensed.
      cartaMilitarEnabled: false,
    },
  },
})
