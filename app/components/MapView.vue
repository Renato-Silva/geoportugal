<script setup lang="ts">
import {
  AttributionControl, GeolocateControl, Map as MlMap, NavigationControl, ScaleControl,
  setWorkerUrl, type GeoJSONSource, type ImageSource, type MapMouseEvent, type MapTouchEvent, type StyleSpecification,
} from 'maplibre-gl'
// MapLibre builds its worker URL at runtime, so Vite never emits the file; ship it as an asset instead.
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'
import type { Bbox, Photo, PhotoLocation } from '~/utils/types'
import { bboxCorners, bboxPolygon, pointBbox } from '~/utils/geo'
import { yearColorExpression } from '~/utils/colors'
import { photosAsGeoJSON } from '~/utils/wfs'
import { DECADES } from '~/composables/useCoverage'
import { photoUrl } from '~/utils/photoUrl'
import { saveBlob } from '~/utils/exporters'
import { ORTHO_YEARS, type BasemapId } from '~/composables/useFototeca'

setWorkerUrl(workerUrl)

const store = useFototeca()
const coverage = useCoverage()
const sheets = useSheets()
const { t, lang } = useI18n()
const { isDark } = useTheme()

const el = ref<HTMLDivElement>()
const compareEl = ref<HTMLDivElement>()
let map: MlMap
let compareMap: MlMap | null = null

// ---------------------------------------------------------------------------
// Basemaps
// ---------------------------------------------------------------------------
const PT_MAINLAND: [number, number, number, number] = [-9.7, 36.8, -6.0, 42.3]
// Proxied: the WMS sends a duplicated CORS header that browsers reject.
const dgtWms = (year: number) => `${location.origin}/api/ortho?year=${year}&z={z}&x={x}&y={y}`

const BASEMAP_SOURCES: Record<string, StyleSpecification['sources'][string]> = {
  'bm-light': {
    type: 'raster', tileSize: 256, maxzoom: 16,
    tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}'],
    attribution: 'Basemap © Esri, HERE, Garmin, © OpenStreetMap',
  },
  'bm-dark': {
    type: 'raster', tileSize: 256, maxzoom: 16,
    tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}'],
    attribution: 'Basemap © Esri, HERE, Garmin, © OpenStreetMap',
  },
  'bm-osm': {
    type: 'raster', tileSize: 256, maxzoom: 19,
    tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  },
  'bm-itineraria': {
    type: 'raster', tileSize: 256, minzoom: 5, maxzoom: 13, bounds: [-10.2, 36.85, -6.05, 42.25],
    tiles: [`${location.origin}/api/itineraria?z={z}&x={x}&y={y}`],
    attribution: 'Carta Militar Itinerária 1:500 000 © CIGeoE',
  },
  'bm-satellite': {
    type: 'raster', tileSize: 256, maxzoom: 19,
    tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
    attribution: 'Imagery © Esri, Maxar, Earthstar Geographics',
  },
  ...Object.fromEntries(ORTHO_YEARS.map(year => [`bm-ortos${year}`, {
    type: 'raster' as const, tileSize: 256, minzoom: 10, maxzoom: 20, bounds: PT_MAINLAND,
    tiles: [dgtWms(year)],
    attribution: `Ortofotos ${year} © DGT`,
  }])),
}

const caopWms = (ws: string, layer: string) =>
  `https://geo2.dgterritorio.gov.pt/geoserver/${ws}/wms?service=WMS&version=1.1.1&request=GetMap&layers=${layer}`
  + '&styles=&srs=EPSG:3857&bbox={bbox-epsg-3857}&width=256&height=256&format=image/png&transparent=true'

/** Administrative boundary lines (CAOP), drawn above photos and labels when enabled. */
const BOUNDARY_SOURCES: Record<string, StyleSpecification['sources'][string]> = {
  'caop-cont': { type: 'raster', tileSize: 256, minzoom: 7, bounds: [-9.6, 36.9, -6.1, 42.2], tiles: [caopWms('caop_continente', 'cont_trocos')], attribution: 'CAOP © DGT' },
  'caop-ram': { type: 'raster', tileSize: 256, minzoom: 7, bounds: [-17.4, 32.3, -16.2, 33.2], tiles: [caopWms('caop_ram', 'ram_trocos')] },
  'caop-raa-co': { type: 'raster', tileSize: 256, minzoom: 7, bounds: [-28.9, 36.9, -24.7, 39.2], tiles: [caopWms('caop_raa', 'raa_cen_ori_trocos')] },
  'caop-raa-oci': { type: 'raster', tileSize: 256, minzoom: 7, bounds: [-31.4, 39.3, -31.0, 39.8], tiles: [caopWms('caop_raa', 'raa_oci_trocos')] },
}

const LABEL_SOURCES: Record<string, StyleSpecification['sources'][string]> = {
  'lb-light': {
    type: 'raster', tileSize: 256, maxzoom: 16,
    tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}'],
  },
  'lb-dark': {
    type: 'raster', tileSize: 256, maxzoom: 16,
    tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}'],
  },
}

/** Place-name labels drawn above the photos, so overlays never hide where you are. */
const labelLayerId = () => store.basemap.value === 'osm' || store.basemap.value === 'itineraria' ? null : (isDark.value || store.basemap.value === 'satellite' || store.basemap.value.startsWith('ortos')) ? 'lb-dark' : 'lb-light'

const basemapLayerId = (b: BasemapId) => b === 'map' ? (isDark.value ? 'bm-dark' : 'bm-light') : `bm-${b}`


const emptyFC: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] }

/** Coverage grid is an overview: it fades out by this zoom, where footprints take over. */
const COVERAGE_MAX_ZOOM = 11.5

function coverageColor(): any {
  const ramp = isDark.value
    ? ['#15346e', '#1f50b0', '#3d7cf0', '#7eaaff', '#c4d9ff']
    : ['#d3e2ff', '#9cc0ff', '#5b98ff', '#1f6fff', '#0a3a9e']
  return ['interpolate', ['linear'], coverage.valueExpression(), 1, ramp[0], 4, ramp[1], 12, ramp[2], 30, ramp[3], 80, ramp[4]]
}

/** Orthophotos only load from z10 and cover the mainland, so satellite sits underneath. */
function isBasemapVisible(id: string) {
  const active = basemapLayerId(store.basemap.value)
  return id === active
    || (id === 'bm-satellite' && active.startsWith('bm-ortos'))
    // the road map only covers mainland Portugal and stops at z5
    || (id === (isDark.value ? 'bm-dark' : 'bm-light') && active === 'bm-itineraria')
}

function buildStyle(): StyleSpecification {
  return {
    version: 8,
    glyphs: 'https://protomaps.github.io/basemaps-assets/fonts/{fontstack}/{range}.pbf',
    sources: {
      ...BASEMAP_SOURCES,
      ...LABEL_SOURCES,
      ...BOUNDARY_SOURCES,
      area: { type: 'geojson', data: emptyFC },
      coverage: { type: 'geojson', data: emptyFC },
      sheets: { type: 'geojson', data: emptyFC },
      footprints: { type: 'geojson', data: emptyFC, promoteId: 'uid' },
      draw: { type: 'geojson', data: emptyFC },
    },
    layers: [
      { id: 'bg', type: 'background', paint: { 'background-color': isDark.value ? '#0c0d10' : '#f5f6f8' } },
      ...Object.keys(BASEMAP_SOURCES).map(id => ({
        id, type: 'raster' as const, source: id,
        layout: { visibility: (isBasemapVisible(id) ? 'visible' : 'none') as 'visible' | 'none' },
        paint: { 'raster-fade-duration': 150 },
      })),
      // Where the archive has photos (country-wide grid), fading out as you zoom in
      {
        id: 'coverage-fill', type: 'fill', source: 'coverage',
        layout: { visibility: store.showCoverage.value ? 'visible' : 'none' },
        filter: ['>', coverage.valueExpression(), 0],
        paint: {
          'fill-color': coverageColor(),
          'fill-opacity': ['interpolate', ['linear'], ['zoom'], 5, 0.6, 10, 0.45, COVERAGE_MAX_ZOOM, 0],
          'fill-antialias': false,
        },
      },
      // photo overlays are inserted here, below the labels
      ...Object.keys(LABEL_SOURCES).map(id => ({
        id, type: 'raster' as const, source: id,
        layout: { visibility: (id === labelLayerId() ? 'visible' : 'none') as 'visible' | 'none' },
        paint: { 'raster-opacity': 0.9 },
      })),
      // DGT draws these in pale green; desaturate them into neutral lines
      ...Object.keys(BOUNDARY_SOURCES).map(id => ({
        id, type: 'raster' as const, source: id,
        layout: { visibility: (store.showBoundaries.value ? 'visible' : 'none') as 'visible' | 'none' },
        paint: { 'raster-saturation': -1, 'raster-opacity': 0.9, ...boundaryBrightness() },
      })),
      // Carta Militar 1:25 000 sheet grid with sheet numbers
      {
        id: 'sheets-line', type: 'line', source: 'sheets', minzoom: 6,
        layout: { visibility: store.showSheets.value ? 'visible' : 'none' },
        paint: { 'line-color': '#b4232a', 'line-width': ['interpolate', ['linear'], ['zoom'], 6, 0.6, 12, 1.4], 'line-opacity': 0.75 },
      },
      {
        id: 'sheets-label', type: 'symbol', source: 'sheets', minzoom: 7.5,
        layout: {
          'visibility': store.showSheets.value ? 'visible' : 'none',
          'text-field': ['case', ['==', ['get', 'series'], 'M888'], ['get', 'sheet'], ['concat', ['get', 'series'], ' ', ['get', 'sheet']]],
          'text-font': ['Noto Sans Medium'],
          'text-size': ['interpolate', ['linear'], ['zoom'], 7.5, 11, 12, 16],
          'symbol-placement': 'point',
          'text-allow-overlap': false,
        },
        paint: { 'text-color': '#8f1b21', 'text-halo-color': '#ffffff', 'text-halo-width': 1.6 },
      },
      {
        id: 'area-fill', type: 'fill', source: 'area', filter: ['==', '$type', 'Polygon'],
        paint: { 'fill-color': isDark.value ? '#4c8dff' : '#1f6fff', 'fill-opacity': 0.04 },
      },
      {
        id: 'area-line', type: 'line', source: 'area', filter: ['==', '$type', 'Polygon'],
        paint: { 'line-color': isDark.value ? '#f2f4f7' : '#0f1115', 'line-width': 1.5, 'line-dasharray': [3, 2], 'line-opacity': 0.7 },
      },
      {
        id: 'footprints-fill', type: 'fill', source: 'footprints',
        paint: {
          'fill-color': yearColorExpression(isDark.value),
          'fill-opacity': ['case',
            ['boolean', ['feature-state', 'hover'], false], 0.32,
            ['boolean', ['feature-state', 'onmap'], false], 0,
            0.06],
        },
      },
      {
        id: 'footprints-line', type: 'line', source: 'footprints',
        paint: {
          'line-color': yearColorExpression(isDark.value),
          'line-width': ['case', ['boolean', ['feature-state', 'hover'], false], 3, 1.25],
          'line-opacity': ['case', ['boolean', ['feature-state', 'onmap'], false], 0.35, 0.9],
        },
      },
      {
        id: 'area-point', type: 'circle', source: 'area', filter: ['==', '$type', 'Point'],
        paint: {
          'circle-radius': 7, 'circle-color': isDark.value ? '#4c8dff' : '#1f6fff',
          'circle-stroke-width': 3, 'circle-stroke-color': isDark.value ? '#0c0d10' : '#ffffff',
        },
      },
      {
        id: 'draw-fill', type: 'fill', source: 'draw',
        paint: { 'fill-color': isDark.value ? '#4c8dff' : '#1f6fff', 'fill-opacity': 0.12 },
      },
      {
        id: 'draw-line', type: 'line', source: 'draw',
        paint: { 'line-color': isDark.value ? '#4c8dff' : '#1f6fff', 'line-width': 2 },
      },
    ],
  }
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------
onMounted(() => {
  const v = store.view.value ?? readInitialView()
  map = new MlMap({
    container: el.value!,
    style: buildStyle(),
    center: [v.lng, v.lat],
    zoom: v.zoom,
    maxZoom: 19,
    attributionControl: false,
    canvasContextAttributes: { preserveDrawingBuffer: true },
    dragRotate: false,
    pitchWithRotate: false,
  })
  map.touchZoomRotate.disableRotation()
  map.addControl(new NavigationControl({ showCompass: false }), 'top-right')
  map.addControl(new GeolocateControl({ positionOptions: { enableHighAccuracy: false }, fitBoundsOptions: { maxZoom: 14 } }), 'top-right')
  map.addControl(new ScaleControl({ unit: 'metric' }), 'bottom-right')
  map.addControl(new AttributionControl({ compact: true, customAttribution: t('credit') }), 'bottom-right')

  map.on('load', () => {
    store.map.value = map
    coverage.load().then(() => src<GeoJSONSource>('coverage')?.setData(coverage.geojson.value ?? emptyFC))
    if (store.showSheets.value) sheets.load().then(() => src<GeoJSONSource>('sheets')?.setData(sheets.geojson.value ?? emptyFC))
    syncFootprints()
    syncArea()
    syncOverlays()
    store.restoreFromUrl()
  })
  map.on('moveend', () => {
    const c = map.getCenter()
    store.view.value = { lng: c.lng, lat: c.lat, zoom: map.getZoom() }
  })
  map.on('movestart', () => { popup.value = null })

  map.on('mousemove', 'footprints-fill', onHover)
  map.on('mouseleave', 'footprints-fill', () => {
    store.hovered.value = null
    map.getCanvas().style.cursor = cursorForMode()
  })
  map.on('click', onClick)
  map.on('mousemove', 'coverage-fill', onCoverageHover)
  map.on('mouseleave', 'coverage-fill', () => { coverageTip.value = null })
  // Right-click / long-press: this spot through time
  map.on('contextmenu', (e) => {
    e.preventDefault()
    store.openTimelapse([e.lngLat.lng, e.lngLat.lat])
  })

  map.on('mousedown', onDrawStart)
  map.on('touchstart', onDrawStart)
  map.on('mousemove', onDrawMove)
  map.on('touchmove', onDrawMove)
  map.on('mouseup', onDrawEnd)
  map.on('touchend', onDrawEnd)
})

onBeforeUnmount(() => {
  compareMap?.remove()
  map?.remove()
  store.map.value = null
})

function readInitialView() {
  const narrow = window.innerWidth < 768
  return { lng: narrow ? -8.1 : -9.6, lat: narrow ? 38.4 : 39.6, zoom: narrow ? 5.4 : 6.4 }
}

// ---------------------------------------------------------------------------
// Data → map
// ---------------------------------------------------------------------------
function src<T>(id: string) {
  return map?.getSource(id) as T | undefined
}

let stateUids = new Set<string>()
function syncFootprints() {
  const s = src<GeoJSONSource>('footprints')
  if (!s) return
  s.setData(photosAsGeoJSON([...store.photos.value, ...store.overlays.value.map(o => o.photo)
    .filter(p => !store.photos.value.some(r => r.uid === p.uid))]))
  syncOnMapState()
}

function syncOnMapState() {
  if (!map?.getSource('footprints')) return
  const now = store.overlayUids.value
  for (const uid of stateUids) if (!now.has(uid)) map.setFeatureState({ source: 'footprints', id: uid }, { onmap: false })
  for (const uid of now) map.setFeatureState({ source: 'footprints', id: uid }, { onmap: true })
  stateUids = new Set(now)
}

function syncArea() {
  const s = src<GeoJSONSource>('area')
  if (!s) return
  const a = store.area.value
  if (!a) return s.setData(emptyFC)
  const b = store.boundary.value
  // An administrative area is drawn by its exact boundary once it has loaded
  if (a.admin && !b) return s.setData(emptyFC)
  const features: GeoJSON.Feature[] = []
  if (b) features.push({ type: 'Feature', geometry: b.geometry, properties: {} })
  else if (a.kind !== 'point') features.push({ type: 'Feature', geometry: bboxPolygon(a.bbox), properties: {} })
  if (a.point) features.push({ type: 'Feature', geometry: { type: 'Point', coordinates: a.point }, properties: {} })
  s.setData({ type: 'FeatureCollection', features })
}

const overlayLayerId = (uid: string) => `ov-${uid}`
let shownOverlays = new Map<string, string>() // uid → image url

function syncOverlays() {
  if (!map?.getLayer('lb-light')) return
  const wanted = store.overlays.value
  const wantedIds = new Set(wanted.map(o => o.photo.uid))
  for (const uid of [...shownOverlays.keys()]) {
    if (wantedIds.has(uid)) continue
    const id = overlayLayerId(uid)
    if (map.getLayer(id)) map.removeLayer(id)
    if (map.getSource(id)) map.removeSource(id)
    shownOverlays.delete(uid)
  }
  for (const o of wanted) {
    const id = overlayLayerId(o.photo.uid)
    const url = photoUrl(o.photo, 'full', { trim: store.cleanEdges.value })
    if (!shownOverlays.has(o.photo.uid)) {
      map.addSource(id, { type: 'image', url, coordinates: bboxCorners(o.photo.bbox) })
      map.addLayer({
        id, type: 'raster', source: id,
        paint: { 'raster-opacity': o.opacity, 'raster-fade-duration': 0, 'raster-resampling': 'linear' },
      }, 'lb-light')
      shownOverlays.set(o.photo.uid, url)
    }
    else if (shownOverlays.get(o.photo.uid) !== url) {
      src<ImageSource>(id)?.updateImage({ url, coordinates: bboxCorners(o.photo.bbox) })
      shownOverlays.set(o.photo.uid, url)
    }
    map.setPaintProperty(id, 'raster-opacity', o.opacity)
    map.setLayoutProperty(id, 'visibility', o.visible ? 'visible' : 'none')
  }
  // keep stacking order = list order (last on top)
  for (const o of wanted) map.moveLayer(overlayLayerId(o.photo.uid), 'lb-light')
}

watch(store.photos, syncFootprints)
watch(store.overlays, () => { syncOverlays(); syncFootprints() }, { deep: true })
watch(store.cleanEdges, syncOverlays)
watch([store.area, store.boundary], syncArea)
watch(store.showBoundaries, (show) => {
  for (const id of Object.keys(BOUNDARY_SOURCES)) map?.setLayoutProperty(id, 'visibility', show ? 'visible' : 'none')
})
watch(coverage.decades, () => {
  if (!map?.getLayer('coverage-fill')) return
  map.setFilter('coverage-fill', ['>', coverage.valueExpression(), 0])
  map.setPaintProperty('coverage-fill', 'fill-color', coverageColor())
}, { deep: true })
watch(store.showSheets, async (show) => {
  for (const id of ['sheets-line', 'sheets-label']) map?.setLayoutProperty(id, 'visibility', show ? 'visible' : 'none')
  if (show) {
    await sheets.load()
    src<GeoJSONSource>('sheets')?.setData(sheets.geojson.value ?? emptyFC)
  }
}, { immediate: false })
watch(store.showCoverage, show => map?.setLayoutProperty('coverage-fill', 'visibility', show ? 'visible' : 'none'))
watch(store.showFootprints, (show) => {
  for (const id of ['footprints-fill', 'footprints-line']) map?.setLayoutProperty(id, 'visibility', show ? 'visible' : 'none')
})

let hoverUid: string | null = null
watch(store.hovered, (uid) => {
  if (!map?.getSource('footprints')) return
  if (hoverUid) map.setFeatureState({ source: 'footprints', id: hoverUid }, { hover: false })
  if (uid) map.setFeatureState({ source: 'footprints', id: uid }, { hover: true })
  hoverUid = uid
})

watch(() => store.basemap.value, () => applyBasemap())
watch(isDark, () => {
  if (!map?.isStyleLoaded()) return
  applyBasemap()
  const color = yearColorExpression(isDark.value)
  map.setPaintProperty('footprints-fill', 'fill-color', color)
  map.setPaintProperty('footprints-line', 'line-color', color)
  const accent = isDark.value ? '#4c8dff' : '#1f6fff'
  map.setPaintProperty('area-fill', 'fill-color', accent)
  map.setPaintProperty('area-point', 'circle-color', accent)
  map.setPaintProperty('area-point', 'circle-stroke-color', isDark.value ? '#0c0d10' : '#ffffff')
  map.setPaintProperty('area-line', 'line-color', isDark.value ? '#f2f4f7' : '#0f1115')
  map.setPaintProperty('draw-fill', 'fill-color', accent)
  map.setPaintProperty('draw-line', 'line-color', accent)
  map.setPaintProperty('coverage-fill', 'fill-color', coverageColor())
  map.setPaintProperty('bg', 'background-color', isDark.value ? '#0c0d10' : '#f5f6f8')

})

/** Boundary lines: light over imagery or the dark map, dark over the light map. */
function boundaryBrightness() {
  const light = isDark.value || store.basemap.value === 'satellite' || store.basemap.value.startsWith('ortos')
  return light
    ? { 'raster-brightness-min': 0.9, 'raster-brightness-max': 1 }
    : { 'raster-brightness-min': 0, 'raster-brightness-max': 0.35 }
}

function applyBasemap() {
  if (!map) return
  const bright = boundaryBrightness()
  for (const id of Object.keys(BOUNDARY_SOURCES)) {
    map.setPaintProperty(id, 'raster-brightness-min', bright['raster-brightness-min'])
    map.setPaintProperty(id, 'raster-brightness-max', bright['raster-brightness-max'])
  }
  for (const id of Object.keys(BASEMAP_SOURCES)) map.setLayoutProperty(id, 'visibility', isBasemapVisible(id) ? 'visible' : 'none')
  for (const id of Object.keys(LABEL_SOURCES)) map.setLayoutProperty(id, 'visibility', id === labelLayerId() ? 'visible' : 'none')
  if (compareMap) setupCompareLayer()
}

// ---------------------------------------------------------------------------
// Interaction
// ---------------------------------------------------------------------------
function cursorForMode() {
  return store.mode.value === 'pan' ? '' : 'crosshair'
}

watch(store.mode, (m) => {
  if (!map) return
  map.getCanvas().style.cursor = cursorForMode()
  if (m === 'box') map.dragPan.disable()
  else map.dragPan.enable()
  popup.value = null
})

function onHover(e: MapMouseEvent & { features?: any[] }) {
  if (store.mode.value !== 'pan' || drawing) return
  const uid = e.features?.[0]?.properties?.uid ?? null
  store.hovered.value = uid
  map.getCanvas().style.cursor = uid ? 'pointer' : ''
}

const popup = ref<{ x: number, y: number, photos: Photo[] } | null>(null)

function photoByUid(uid: string) {
  return store.photos.value.find(p => p.uid === uid) ?? store.overlays.value.find(o => o.photo.uid === uid)?.photo
}

function onClick(e: MapMouseEvent) {
  if (store.mode.value === 'point') {
    const pt: [number, number] = [e.lngLat.lng, e.lngLat.lat]
    store.mode.value = 'pan'
    // Name the spot by its parish when we can (quick, cached lookup)
    $fetch<PhotoLocation>('/api/locate', { query: { lon: pt[0], lat: pt[1] }, timeout: 2500 })
      .catch(() => ({} as PhotoLocation))
      .then((loc) => {
        const where = loc.parish ? `${loc.parish.name}, ${loc.municipality}` : null
        store.setArea({
          kind: 'point',
          label: where ? `${t('area.point')} · ${where}` : t('area.pointLabel', { lat: pt[1].toFixed(4), lng: pt[0].toFixed(4) }),
          bbox: pointBbox(pt),
          point: pt,
        })
      })
    return
  }
  if (store.mode.value !== 'pan' || !store.showFootprints.value) return
  const feats = map.queryRenderedFeatures(e.point, { layers: ['footprints-fill'] })
  const uids = [...new Set(feats.map(f => f.properties?.uid as string))]
  const hits = uids.map(photoByUid).filter((p): p is Photo => !!p)
    .sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''))
  if (!hits.length) {
    popup.value = null
    searchCoverageCell(e)
    return
  }
  if (hits.length === 1) {
    popup.value = null
    store.toggleOverlay(hits[0]!)
    return
  }
  popup.value = { x: e.point.x, y: e.point.y, photos: hits }
}

// Coverage grid: hover hint and click-to-search ------------------------------------
const coverageTip = ref<{ x: number, y: number, count: number } | null>(null)

function coverageAt(e: MapMouseEvent) {
  if (map.getZoom() >= COVERAGE_MAX_ZOOM - 0.5 || !store.showCoverage.value) return null
  return map.queryRenderedFeatures(e.point, { layers: ['coverage-fill'] })[0] ?? null
}

function onCoverageHover(e: MapMouseEvent) {
  if (store.mode.value !== 'pan' || store.hovered.value) return (coverageTip.value = null)
  const f = coverageAt(e)
  if (!f) return (coverageTip.value = null)
  const idx = coverage.decades.value.length ? coverage.decades.value : DECADES.map((_, i) => i)
  const count = idx.reduce((n, i) => n + Number(f.properties?.[`c${i}`] ?? 0), 0)
  coverageTip.value = { x: e.point.x, y: e.point.y, count }
  map.getCanvas().style.cursor = 'pointer'
}

function searchCoverageCell(e: MapMouseEvent) {
  const f = coverageAt(e)
  if (!f || f.geometry.type !== 'Polygon') return
  const ring = f.geometry.coordinates[0]!
  const xs = ring.map(c => c[0]!), ys = ring.map(c => c[1]!)
  coverageTip.value = null
  store.setArea({ kind: 'box', label: t('coverage.cell'), bbox: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)] }, { fit: true })
}

// Box drawing -------------------------------------------------------------------
let drawing: { start: [number, number] } | null = null

function onDrawStart(e: MapMouseEvent | MapTouchEvent) {
  if (store.mode.value !== 'box') return
  if ('points' in e && e.points.length > 1) return
  e.preventDefault()
  drawing = { start: [e.lngLat.lng, e.lngLat.lat] }
}

function currentBox(e: MapMouseEvent | MapTouchEvent): Bbox {
  const [x0, y0] = drawing!.start
  const { lng: x1, lat: y1 } = e.lngLat
  return [Math.min(x0, x1), Math.min(y0, y1), Math.max(x0, x1), Math.max(y0, y1)]
}

function onDrawMove(e: MapMouseEvent | MapTouchEvent) {
  if (!drawing) return
  src<GeoJSONSource>('draw')?.setData({ type: 'Feature', geometry: bboxPolygon(currentBox(e)), properties: {} })
}

function onDrawEnd(e: MapMouseEvent | MapTouchEvent) {
  if (!drawing) return
  const box = currentBox(e)
  drawing = null
  src<GeoJSONSource>('draw')?.setData(emptyFC)
  const p0 = map.project([box[0], box[1]]), p1 = map.project([box[2], box[3]])
  if (Math.abs(p1.x - p0.x) < 8 || Math.abs(p1.y - p0.y) < 8) return
  store.setArea({ kind: 'box', label: t('area.boxLabel'), bbox: box })
}

// ---------------------------------------------------------------------------
// Then / now swipe
// ---------------------------------------------------------------------------
function syncCompareCamera() {
  compareMap?.jumpTo({ center: map.getCenter(), zoom: map.getZoom(), bearing: map.getBearing(), pitch: map.getPitch() })
}

/** "Now" side: the chosen orthophoto year (mainland, z10+) over satellite imagery. */
function setupCompareLayer() {
  if (!compareMap?.isStyleLoaded()) return
  for (const y of ORTHO_YEARS)
    compareMap.setLayoutProperty(`bm-ortos${y}`, 'visibility', y === store.compare.year ? 'visible' : 'none')
}

watch(() => store.compare.year, setupCompareLayer)

watch(() => store.compare.enabled, async (on) => {
  if (!on) {
    compareMap?.remove()
    compareMap = null
    map?.off('move', syncCompareCamera)
    return
  }
  // Start the divider in the middle of the visible map, not under the side panel.
  const w = window.innerWidth
  if (w >= 768) store.compare.position = (444 + (w - 444) / 2) / w
  await nextTick()
  if (!compareEl.value || !map) return
  compareMap = new MlMap({
    container: compareEl.value,
    interactive: false,
    attributionControl: false,
    center: map.getCenter(),
    zoom: map.getZoom(),
    canvasContextAttributes: { preserveDrawingBuffer: true },
    style: {
      version: 8,
      sources: {
        'bm-satellite': BASEMAP_SOURCES['bm-satellite']!,
        ...Object.fromEntries(ORTHO_YEARS.map(y => [`bm-ortos${y}`, BASEMAP_SOURCES[`bm-ortos${y}`]!])),
      },
      layers: [
        { id: 'bg', type: 'background', paint: { 'background-color': '#1a1c21' } },
        { id: 'bm-satellite', type: 'raster', source: 'bm-satellite' },
        ...ORTHO_YEARS.map(y => ({
          id: `bm-ortos${y}`, type: 'raster' as const, source: `bm-ortos${y}`,
          layout: { visibility: (y === store.compare.year ? 'visible' : 'none') as 'visible' | 'none' },
        })),
      ],
    },
  })
  compareMap.on('load', () => {
    compareMap?.resize()
    syncCompareCamera()
    setupCompareLayer()
  })
  map.on('move', syncCompareCamera)
}, { flush: 'post' })

const dividerX = computed(() => `${store.compare.position * 100}%`)

function startSwipe(e: PointerEvent) {
  const box = el.value!.getBoundingClientRect()
  const target = e.currentTarget as HTMLElement
  target.setPointerCapture(e.pointerId)
  const move = (ev: PointerEvent) => {
    store.compare.position = Math.min(Math.max((ev.clientX - box.left) / box.width, 0.02), 0.98)
  }
  const up = () => {
    target.removeEventListener('pointermove', move)
    target.removeEventListener('pointerup', up)
  }
  target.addEventListener('pointermove', move)
  target.addEventListener('pointerup', up)
}

function nudgeSwipe(e: KeyboardEvent) {
  const step = e.shiftKey ? 0.1 : 0.02
  if (e.key === 'ArrowLeft') store.compare.position = Math.max(0.02, store.compare.position - step)
  if (e.key === 'ArrowRight') store.compare.position = Math.min(0.98, store.compare.position + step)
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------
function exportPng() {
  map.once('render', () => {
    map.getCanvas().toBlob((blob) => {
      if (blob) saveBlob(blob, `geoportugal-mapa-${new Date().toISOString().slice(0, 10)}.png`)
    }, 'image/png')
  })
  map.triggerRepaint()
}

defineExpose({ exportPng })

// Close popup on Escape
function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    popup.value = null
    if (store.mode.value !== 'pan') store.mode.value = 'pan'
  }
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))

const popupStyle = computed(() => {
  if (!popup.value || !el.value) return {}
  const w = el.value.clientWidth, h = el.value.clientHeight
  const left = Math.min(Math.max(popup.value.x + 12, 8), w - 312)
  const top = Math.min(Math.max(popup.value.y - 20, 8), h - 340)
  return { left: `${left}px`, top: `${top}px` }
})
</script>

<template>
  <div class="absolute inset-0">
    <div ref="el" class="h-full w-full" />

    <!-- Then / now: modern imagery clipped to the right of the divider -->
    <template v-if="store.compare.enabled">
      <div
        class="pointer-events-none absolute inset-0"
        :style="{ clipPath: `inset(0 0 0 ${dividerX})` }"
      >
        <div ref="compareEl" class="h-full w-full" />
      </div>
      <div class="pointer-events-none absolute inset-y-0 z-10" :style="{ left: dividerX }">
        <div class="absolute inset-y-0 -translate-x-1/2 w-[2px] bg-white shadow-[0_0_0_1px_rgb(0_0_0/.25)]" />
        <button
          type="button"
          class="pointer-events-auto absolute top-1/2 -translate-x-1/2 -translate-y-1/2 grid size-11 cursor-ew-resize touch-none place-items-center rounded-full border-[3px] border-white bg-accent text-accent-ink shadow-xl"
          role="slider"
          :aria-label="t('compare.toggle')"
          :aria-valuenow="Math.round(store.compare.position * 100)"
          aria-valuemin="0"
          aria-valuemax="100"
          @pointerdown="startSwipe"
          @keydown="nudgeSwipe"
        >
          <svg viewBox="0 0 24 24" class="size-5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 6-6 6 6 6M15 6l6 6-6 6" /></svg>
        </button>
        <span class="absolute bottom-24 right-4 rounded-full bg-black/60 px-3 py-1 text-xs font-medium text-white backdrop-blur md:bottom-10">{{ t('compare.then') }}</span>
        <span class="absolute bottom-24 left-4 rounded-full bg-black/60 px-3 py-1 text-xs font-medium text-white backdrop-blur md:bottom-10">{{ t('compare.now') }}</span>
      </div>
    </template>

    <!-- Mode hint -->
    <Transition name="fade">
      <div
        v-if="store.mode.value !== 'pan'"
        class="absolute left-1/2 top-4 z-20 flex -translate-x-1/2 items-center gap-3 rounded-full bg-ink/90 py-2 pl-4 pr-2 text-sm text-paper shadow-panel backdrop-blur md:left-[calc(50%+210px)]"
      >
        <span class="size-2 animate-pulse rounded-full bg-accent" />
        {{ store.mode.value === 'box' ? t('hint.box') : t('hint.point') }}
        <button type="button" class="rounded-full bg-paper/15 px-3 py-1 text-xs hover:bg-paper/25" @click="store.mode.value = 'pan'">
          {{ t('hint.cancel') }}
        </button>
      </div>
    </Transition>

    <!-- Coverage hint -->
    <div
      v-if="coverageTip"
      class="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-[calc(100%+12px)] whitespace-nowrap rounded-lg bg-ink/90 px-2.5 py-1.5 text-xs text-paper shadow-lg backdrop-blur"
      :style="{ left: `${coverageTip.x}px`, top: `${coverageTip.y}px` }"
    >
      <b class="font-semibold">{{ t('coverage.tip', { n: coverageTip.count.toLocaleString(lang === 'pt' ? 'pt-PT' : 'en-GB') }) }}</b>
      <span class="opacity-70"> · {{ t('coverage.click') }}</span>
    </div>

    <!-- Overlapping footprints picker -->
    <div
      v-if="popup"
      class="grain rise absolute z-30 w-[300px] overflow-hidden rounded-2xl border border-rule shadow-panel"
      :style="popupStyle"
    >
      <div class="flex items-center justify-between border-b border-rule px-3 py-2">
        <span class="text-xs font-medium text-ink-2">{{ t('popup.title', { n: popup.photos.length }) }}</span>
        <button type="button" class="grid size-6 place-items-center rounded text-ink-3 hover:bg-paper-2 hover:text-ink" aria-label="Close" @click="popup = null">
          <svg viewBox="0 0 24 24" class="size-4" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6 6 18" /></svg>
        </button>
      </div>
      <ul class="scroll-thin max-h-[280px] overflow-y-auto p-1">
        <li v-for="p in popup.photos" :key="p.uid">
          <PhotoRow :photo="p" :list="popup.photos" />
        </li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: opacity .2s, transform .2s; }
.fade-enter-from, .fade-leave-to { opacity: 0; transform: translate(-50%, -6px); }
</style>
