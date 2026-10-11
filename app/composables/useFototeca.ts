import type { Map as MlMap } from 'maplibre-gl'
import type { Area, Bbox, Overlay, Photo, YearScaleCount } from '~/utils/types'
import { YEAR_MAX, YEAR_MIN } from '~/utils/colors'
import { fetchPhotos, fetchPhotosByUid } from '~/utils/wfs'
import { parseBbox, roundBbox } from '~/utils/geo'
import { readStore, writeStore } from '~/utils/storage'

/** Orthophoto years DGT publishes as a public WMS. */
export const ORTHO_YEARS = [2007, 2010, 2012, 2015, 2018, 2021] as const
export type OrthoYear = typeof ORTHO_YEARS[number]
export type BasemapId = 'map' | 'osm' | 'satellite' | `ortos${OrthoYear}`
const BASEMAP_IDS: BasemapId[] = ['map', 'osm', 'satellite', ...ORTHO_YEARS.map(y => `ortos${y}` as const)]
export type MapMode = 'pan' | 'box' | 'point'
export type Tab = 'search' | 'map' | 'saved'

const PAGE_SIZE = 200
const MAX_OVERLAYS = 80
const MAX_RECENT = 10

// ---------------------------------------------------------------------------
// State (module singletons — this is a client-only SPA)
// ---------------------------------------------------------------------------
const map = shallowRef<MlMap | null>(null)
const tab = ref<Tab>('search')

const area = shallowRef<Area | null>(null)
const summary = shallowRef<YearScaleCount[]>([])
const summaryState = ref<'idle' | 'loading' | 'ready' | 'error'>('idle')

const years = ref<[number, number]>([YEAR_MIN, YEAR_MAX])
const scales = ref<number[]>([])
const newestFirst = ref(false)

const photos = shallowRef<Photo[]>([])
const total = ref(0)
const photosState = ref<'idle' | 'loading' | 'more' | 'ready' | 'error'>('idle')

const hovered = ref<string | null>(null)
const selected = ref<string[]>([])

const overlays = ref<Overlay[]>([])
const cleanEdges = ref(readStore('geoportugal:cleanEdges', true))
const showFootprints = ref(true)
const basemap = ref<BasemapId>('map')
const compare = reactive({ enabled: false, position: 0.5, year: 2021 as OrthoYear })
const mode = ref<MapMode>('pan')

const viewer = shallowRef<{ list: Photo[], index: number } | null>(null)

const favs = ref<Photo[]>(readStore('geoportugal:favs', []))
const recentAreas = ref<Area[]>(readStore('geoportugal:recentAreas', []))
const recentPhotos = ref<Photo[]>(readStore('geoportugal:recentPhotos', []))

watch(favs, v => writeStore('geoportugal:favs', v), { deep: true })
watch(recentAreas, v => writeStore('geoportugal:recentAreas', v), { deep: true })
watch(recentPhotos, v => writeStore('geoportugal:recentPhotos', v), { deep: true })
watch(cleanEdges, v => writeStore('geoportugal:cleanEdges', v))

// ---------------------------------------------------------------------------
// Derived
// ---------------------------------------------------------------------------
const dataYears = computed<[number, number] | null>(() => {
  if (!summary.value.length) return null
  const ys = summary.value.map(s => s.year)
  return [Math.min(...ys), Math.max(...ys)]
})

/** Photos per year, honouring the scale filter (the timeline). */
const yearCounts = computed(() => {
  const m = new Map<number, number>()
  for (const s of summary.value) {
    if (scales.value.length && !scales.value.includes(s.scale)) continue
    m.set(s.year, (m.get(s.year) ?? 0) + s.count)
  }
  return m
})

/** Photos per scale, honouring the year range (the scale chips). */
const scaleCounts = computed(() => {
  const m = new Map<number, number>()
  for (const s of summary.value) {
    if (s.year < years.value[0] || s.year > years.value[1]) continue
    m.set(s.scale, (m.get(s.scale) ?? 0) + s.count)
  }
  return [...m.entries()].sort((a, b) => a[0] - b[0])
})

const overlayUids = computed(() => new Set(overlays.value.map(o => o.photo.uid)))
const favUids = computed(() => new Set(favs.value.map(p => p.uid)))

// ---------------------------------------------------------------------------
// Loading
// ---------------------------------------------------------------------------
let summaryAbort: AbortController | null = null
let photosAbort: AbortController | null = null

async function loadSummary(bbox: Bbox) {
  summaryAbort?.abort()
  const ctrl = summaryAbort = new AbortController()
  summaryState.value = 'loading'
  try {
    const data = await $fetch<YearScaleCount[]>('/api/summary', {
      query: { bbox: roundBbox(bbox).join(',') },
      signal: ctrl.signal,
    })
    if (ctrl.signal.aborted) return
    summary.value = data
    summaryState.value = 'ready'
  }
  catch (e) {
    if (ctrl.signal.aborted) return
    console.error(e)
    summary.value = []
    summaryState.value = 'error'
  }
}

async function loadPhotos(more = false) {
  const a = area.value
  if (!a) return
  photosAbort?.abort()
  const ctrl = photosAbort = new AbortController()
  photosState.value = more ? 'more' : 'loading'
  try {
    const res = await fetchPhotos(
      { bbox: a.bbox, years: years.value, scales: scales.value },
      { start: more ? photos.value.length : 0, count: PAGE_SIZE, newestFirst: newestFirst.value, signal: ctrl.signal },
    )
    if (ctrl.signal.aborted) return
    photos.value = more ? [...photos.value, ...res.photos] : res.photos
    total.value = res.total
    photosState.value = 'ready'
  }
  catch (e) {
    if (ctrl.signal.aborted) return
    console.error(e)
    photosState.value = 'error'
  }
}

let filterTimer: ReturnType<typeof setTimeout> | undefined
watch([years, scales, newestFirst], () => {
  if (!area.value || summaryState.value === 'loading') return
  clearTimeout(filterTimer)
  filterTimer = setTimeout(() => loadPhotos(), 250)
}, { deep: true, flush: 'sync' })

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------
function fitBbox(b: Bbox, opts: { maxZoom?: number, animate?: boolean } = {}) {
  const m = map.value
  if (!m) return
  const wide = window.innerWidth >= 768
  m.fitBounds([[b[0], b[1]], [b[2], b[3]]], {
    padding: wide
      ? { top: 60, bottom: 60, left: 460, right: 60 }
      : { top: 40, bottom: Math.round(window.innerHeight * 0.5), left: 30, right: 30 },
    maxZoom: opts.maxZoom ?? 15,
    duration: opts.animate === false ? 0 : 900,
  })
}

async function setArea(a: Area, opts: { keepFilters?: boolean, fit?: boolean } = {}) {
  area.value = a
  selected.value = []
  photos.value = []
  total.value = 0
  tab.value = 'search'
  mode.value = 'pan'
  if (a.kind !== 'view') {
    recentAreas.value = [a, ...recentAreas.value.filter(r => r.label !== a.label || r.bbox.join() !== a.bbox.join())].slice(0, MAX_RECENT)
  }
  if (opts.fit ?? a.kind === 'place') fitBbox(a.bbox)
  await loadSummary(a.bbox)
  if (area.value !== a) return
  if (!opts.keepFilters) {
    scales.value = []
    years.value = dataYears.value ?? [YEAR_MIN, YEAR_MAX]
  }
  clearTimeout(filterTimer)
  if (summary.value.length || opts.keepFilters) await loadPhotos()
  else photosState.value = 'ready'
}

function clearArea() {
  summaryAbort?.abort()
  photosAbort?.abort()
  area.value = null
  summary.value = []
  summaryState.value = 'idle'
  photos.value = []
  total.value = 0
  photosState.value = 'idle'
  selected.value = []
  years.value = [YEAR_MIN, YEAR_MAX]
  scales.value = []
}

function resetYears() {
  years.value = dataYears.value ?? [YEAR_MIN, YEAR_MAX]
}

function toggleScale(s: number) {
  scales.value = scales.value.includes(s) ? scales.value.filter(x => x !== s) : [...scales.value, s].sort((a, b) => a - b)
}

// Overlays ------------------------------------------------------------------
function addOverlays(list: Photo[]) {
  const have = overlayUids.value
  const fresh = list.filter(p => !have.has(p.uid)).map(photo => ({ photo, opacity: 1, visible: true }))
  overlays.value = [...overlays.value, ...fresh].slice(-MAX_OVERLAYS)
}

function removeOverlay(uid: string) {
  overlays.value = overlays.value.filter(o => o.photo.uid !== uid)
}

function toggleOverlay(p: Photo) {
  if (overlayUids.value.has(p.uid)) removeOverlay(p.uid)
  else addOverlays([p])
}

function clearOverlays() {
  overlays.value = []
}

// Saved / recent --------------------------------------------------------------
function toggleFav(p: Photo) {
  favs.value = favUids.value.has(p.uid) ? favs.value.filter(f => f.uid !== p.uid) : [p, ...favs.value]
}

function openViewer(list: Photo[], index: number) {
  if (!list[index]) return
  viewer.value = { list, index }
}

function closeViewer() {
  viewer.value = null
}

watch(viewer, (v) => {
  const p = v?.list[v.index]
  if (p) recentPhotos.value = [p, ...recentPhotos.value.filter(r => r.uid !== p.uid)].slice(0, 24)
})

// Selection -------------------------------------------------------------------
function toggleSelected(uid: string) {
  selected.value = selected.value.includes(uid) ? selected.value.filter(u => u !== uid) : [...selected.value, uid]
}

// ---------------------------------------------------------------------------
// Shareable URL state
// ---------------------------------------------------------------------------
function viewFromUrl() {
  const m = new URLSearchParams(location.search).get('m')?.split('/').map(Number)
  return m?.length === 3 && m.every(Number.isFinite) ? { zoom: m[0]!, lat: m[1]!, lng: m[2]! } : null
}

// Read synchronously so the map can be created at the shared position.
const view = ref<{ lng: number, lat: number, zoom: number } | null>(viewFromUrl())

function readUrl() {
  const q = new URLSearchParams(location.search)
  const out = {
    view: null as null | { lng: number, lat: number, zoom: number },
    area: null as Area | null,
    years: null as [number, number] | null,
    scales: [] as number[],
    overlays: [] as string[],
    viewerUid: q.get('photo'),
  }
  out.view = viewFromUrl()
  const bbox = parseBbox(q.get('bbox'))
  const kind = q.get('kind') as Area['kind'] | null
  if (bbox) {
    const pt = q.get('pt')?.split(',').map(Number)
    out.area = {
      kind: kind && ['place', 'view', 'box', 'point'].includes(kind) ? kind : 'box',
      label: q.get('area') ?? '',
      bbox,
      ...(pt?.length === 2 && pt.every(Number.isFinite) ? { point: pt as [number, number] } : {}),
    }
  }
  const y = q.get('years')?.split('-').map(Number)
  if (y?.length === 2 && y.every(Number.isFinite)) out.years = [y[0]!, y[1]!]
  out.scales = (q.get('scales') ?? '').split(',').map(Number).filter(n => n > 0)
  out.overlays = (q.get('on') ?? '').split(',').filter(Boolean)
  const bm = q.get('base') as BasemapId | null
  if (bm && BASEMAP_IDS.includes(bm)) basemap.value = bm
  if (q.get('compare') === '1') compare.enabled = true
  const cy = Number(q.get('cy'))
  if ((ORTHO_YEARS as readonly number[]).includes(cy)) compare.year = cy as OrthoYear
  return out
}

function buildUrl(includeView = true) {
  const q = new URLSearchParams()
  if (includeView && view.value) {
    const { zoom, lat, lng } = view.value
    q.set('m', `${zoom.toFixed(2)}/${lat.toFixed(5)}/${lng.toFixed(5)}`)
  }
  const a = area.value
  if (a) {
    q.set('kind', a.kind)
    q.set('area', a.label)
    q.set('bbox', roundBbox(a.bbox).join(','))
    if (a.point) q.set('pt', a.point.map(n => n.toFixed(5)).join(','))
    const dy = dataYears.value
    if (!dy || years.value[0] !== dy[0] || years.value[1] !== dy[1]) q.set('years', years.value.join('-'))
    if (scales.value.length) q.set('scales', scales.value.join(','))
  }
  if (overlays.value.length) q.set('on', overlays.value.map(o => o.photo.uid).join(','))
  if (basemap.value !== 'map') q.set('base', basemap.value)
  if (compare.enabled) q.set('compare', '1')
  if (compare.enabled && compare.year !== 2021) q.set('cy', String(compare.year))
  const v = viewer.value?.list[viewer.value.index]
  if (v) q.set('photo', v.uid)
  const s = q.toString().replace(/%2C/g, ',').replace(/%2F/g, '/')
  return `${location.pathname}${s ? `?${s}` : ''}`
}

let urlTimer: ReturnType<typeof setTimeout> | undefined
function scheduleUrlWrite() {
  clearTimeout(urlTimer)
  urlTimer = setTimeout(() => history.replaceState(null, '', buildUrl()), 300)
}

let restored = false
async function restoreFromUrl() {
  if (restored) return
  restored = true
  const s = readUrl()
  if (s.view) view.value = s.view
  watch([view, area, years, scales, overlays, basemap, () => compare.enabled, () => compare.year, viewer], scheduleUrlWrite, { deep: true })

  const tasks: Promise<unknown>[] = []
  if (s.area) {
    if (s.years) years.value = s.years
    scales.value = s.scales
    tasks.push(setArea(s.area, { keepFilters: !!(s.years || s.scales.length), fit: !s.view }))
  }
  const uids = [...new Set([...s.overlays, ...(s.viewerUid ? [s.viewerUid] : [])])]
  if (uids.length) {
    tasks.push(fetchPhotosByUid(uids).then((found) => {
      addOverlays(found.filter(p => s.overlays.includes(p.uid)))
      const v = found.find(p => p.uid === s.viewerUid)
      if (v) openViewer([v], 0)
      if (!s.view && !s.area && found.length) fitBbox(found[0]!.bbox, { animate: false })
    }).catch(console.error))
  }
  await Promise.all(tasks)
}

// ---------------------------------------------------------------------------
export function useFototeca() {
  return {
    // state
    map, tab, area, summary, summaryState, years, scales, newestFirst,
    photos, total, photosState, hovered, selected, overlays, cleanEdges, showFootprints,
    basemap, compare, mode, viewer, favs, recentAreas, recentPhotos, view,
    // derived
    dataYears, yearCounts, scaleCounts, overlayUids, favUids,
    // actions
    setArea, clearArea, loadPhotos, resetYears, toggleScale, fitBbox,
    addOverlays, removeOverlay, toggleOverlay, clearOverlays,
    toggleFav, openViewer, closeViewer, toggleSelected,
    restoreFromUrl, buildUrl,
    PAGE_SIZE,
  }
}
