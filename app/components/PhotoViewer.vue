<script setup lang="ts">
import { photoUrl, sourceUrl } from '~/utils/photoUrl'
import { formatCount, formatDate, formatScale } from '~/utils/format'
import { yearColor } from '~/utils/colors'

const store = useFototeca()
const { t, lang } = useI18n()
const { isDark } = useTheme()
const dl = useDownloads()

const v = computed(() => store.viewer.value)
const photo = computed(() => v.value?.list[v.value.index] ?? null)
const onMap = computed(() => !!photo.value && store.overlayUids.value.has(photo.value.uid))
const fav = computed(() => !!photo.value && store.favUids.value.has(photo.value.uid))

// zoom & pan --------------------------------------------------------------
const stage = ref<HTMLDivElement>()
const z = reactive({ scale: 1, x: 0, y: 0 })
const loading = ref(true)
const failed = ref(false)

function reset() {
  z.scale = 1
  z.x = 0
  z.y = 0
}

watch(photo, () => {
  reset()
  loading.value = true
  failed.value = false
  // warm the neighbours
  const l = v.value
  if (!l) return
  for (const d of [-1, 1]) {
    const n = l.list[l.index + d]
    if (n) new Image().src = photoUrl(n, 'full')
  }
}, { immediate: true })

function zoomAt(factor: number, cx: number, cy: number) {
  const r = stage.value!.getBoundingClientRect()
  const px = cx - r.left - r.width / 2
  const py = cy - r.top - r.height / 2
  const next = Math.min(Math.max(z.scale * factor, 1), 10)
  const k = next / z.scale
  z.x = px - (px - z.x) * k
  z.y = py - (py - z.y) * k
  z.scale = next
  if (next === 1) reset()
}

function onWheel(e: WheelEvent) {
  e.preventDefault()
  zoomAt(Math.exp(-e.deltaY * 0.0018), e.clientX, e.clientY)
}

function zoomButton(f: number) {
  const r = stage.value!.getBoundingClientRect()
  zoomAt(f, r.left + r.width / 2, r.top + r.height / 2)
}

const drag = shallowRef<{ x: number, y: number, ox: number, oy: number } | null>(null)
function onDown(e: PointerEvent) {
  if (z.scale === 1) return
  ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
  drag.value = { x: e.clientX, y: e.clientY, ox: z.x, oy: z.y }
}
function onMove(e: PointerEvent) {
  const d = drag.value
  if (!d) return
  z.x = d.ox + e.clientX - d.x
  z.y = d.oy + e.clientY - d.y
}
function onUp() {
  drag.value = null
}
function onDbl(e: MouseEvent) {
  if (z.scale > 1) reset()
  else zoomAt(3, e.clientX, e.clientY)
}

// navigation ----------------------------------------------------------------
function go(d: number) {
  const l = v.value
  if (!l) return
  const i = l.index + d
  if (i >= 0 && i < l.list.length) store.viewer.value = { list: l.list, index: i }
}

function onKey(e: KeyboardEvent) {
  if (!v.value) return
  if (e.key === 'Escape') store.closeViewer()
  else if (e.key === 'ArrowLeft') go(-1)
  else if (e.key === 'ArrowRight') go(1)
  else if (e.key === '+' || e.key === '=') zoomButton(1.5)
  else if (e.key === '-') zoomButton(1 / 1.5)
  else if (e.key === 'm' && photo.value) store.toggleOverlay(photo.value)
  else if (e.key === 's' && photo.value) store.toggleFav(photo.value)
  else return
  e.preventDefault()
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))

function showOnMap() {
  const p = photo.value
  if (!p) return
  if (!onMap.value) store.addOverlays([p])
  store.closeViewer()
  store.tab.value = 'map'
  store.fitBbox(p.bbox, { maxZoom: 16 })
}

const meta = computed(() => {
  const p = photo.value
  if (!p) return []
  return [
    [t('photo.date'), formatDate(p.date, lang.value)],
    [t('photo.scale'), formatScale(p.scale, lang.value)],
    [t('photo.roll'), p.rolo],
    [t('photo.strip'), p.fiada || '—'],
    [t('photo.frame'), p.foto],
    [t('photo.work'), p.work || '—'],
    [t('photo.support'), p.support || '—'],
    [t('photo.format'), p.format ? `${p.format} mm` : '—'],
    [t('photo.focal'), p.focal ? `${formatCount(p.focal, lang.value)} mm` : '—'],
    [t('photo.resolution'), p.resolution ? formatCount(p.resolution, lang.value) : '—'],
    [t('photo.file'), p.file || '—'],
  ] as const
})
</script>

<template>
  <Transition name="viewer">
    <div v-if="photo" class="fixed inset-0 z-50 flex flex-col bg-paper/95 text-ink backdrop-blur-md md:flex-row" role="dialog" aria-modal="true" :aria-label="`${photo.rolo} / ${photo.foto}`">
      <!-- stage -->
      <div
        ref="stage"
        class="relative min-h-0 flex-1 touch-none overflow-hidden"
        :class="z.scale > 1 ? 'cursor-grab active:cursor-grabbing' : 'cursor-zoom-in'"
        @wheel="onWheel"
        @pointerdown="onDown"
        @pointermove="onMove"
        @pointerup="onUp"
        @pointercancel="onUp"
        @dblclick="onDbl"
      >
        <img
          :key="photo.uid"
          :src="photoUrl(photo, 'full')"
          :alt="`${photo.rolo} / ${photo.foto}`"
          draggable="false"
          class="absolute inset-0 m-auto max-h-[calc(100%-48px)] max-w-[calc(100%-48px)] select-none object-contain transition-opacity duration-300"
          :class="loading ? 'opacity-0' : 'opacity-100'"
          :style="{ transform: `translate(${z.x}px, ${z.y}px) scale(${z.scale})`, transition: drag ? 'none' : 'transform .12s ease-out, opacity .3s' }"
          @load="loading = false"
          @error="loading = false; failed = true"
        >
        <div v-if="loading" class="absolute inset-0 grid place-items-center">
          <span class="size-8 animate-spin rounded-full border-2 border-rule border-t-accent" />
        </div>
        <p v-if="failed" class="absolute inset-0 grid place-items-center text-sm text-ink-3">{{ t('toast.loadFail') }}</p>

        <!-- nav -->
        <button
          v-if="v!.index > 0"
          type="button"
          class="absolute left-3 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full border border-rule bg-card shadow-sm hover:bg-paper-2"
          aria-label="Previous"
          @click.stop="go(-1)"
          @pointerdown.stop
        >
          <Icon name="chevronLeft" :size="22" />
        </button>
        <button
          v-if="v!.index < v!.list.length - 1"
          type="button"
          class="absolute right-3 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full border border-rule bg-card shadow-sm hover:bg-paper-2"
          aria-label="Next"
          @click.stop="go(1)"
          @pointerdown.stop
        >
          <Icon name="chevronRight" :size="22" />
        </button>

        <!-- zoom controls -->
        <div class="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full border border-rule bg-card p-1 text-sm shadow-panel" @pointerdown.stop>
          <button type="button" class="grid size-8 place-items-center rounded-full hover:bg-paper-2" aria-label="Zoom out" @click="zoomButton(1 / 1.5)">−</button>
          <span class="w-12 text-center font-mono text-xs">{{ Math.round(z.scale * 100) }}%</span>
          <button type="button" class="grid size-8 place-items-center rounded-full hover:bg-paper-2" aria-label="Zoom in" @click="zoomButton(1.5)">+</button>
        </div>
        <span class="absolute left-4 top-4 rounded-full bg-card px-2.5 py-1 text-xs tabular-nums text-ink-2 shadow-sm">{{ v!.index + 1 }} / {{ v!.list.length }}</span>
      </div>

      <!-- sidebar -->
      <aside class="scroll-thin flex max-h-[45vh] w-full shrink-0 flex-col overflow-y-auto border-t border-rule bg-card md:max-h-none md:w-[340px] md:border-l md:border-t-0">
        <div class="flex items-start justify-between gap-3 p-5 pb-3">
          <div class="min-w-0">
            <p class="text-xs text-ink-3">{{ t('results.flight', { rolo: photo.rolo }) }} · Nº {{ photo.foto }}</p>
            <h2 class="mt-1 text-[24px] font-semibold leading-tight tracking-tight">{{ formatDate(photo.date, lang) }}</h2>
            <div class="mt-2 flex items-center gap-2 text-sm text-ink-2">
              <span class="size-2.5 rounded-full" :style="{ background: yearColor(photo.year, isDark) }" />
              {{ formatScale(photo.scale, lang) }}
            </div>
          </div>
          <button type="button" class="grid size-9 shrink-0 place-items-center rounded-full border border-rule bg-card shadow-sm hover:bg-paper-2" aria-label="Close" @click="store.closeViewer()">
            <Icon name="close" />
          </button>
        </div>

        <div class="grid grid-cols-2 gap-1.5 px-5">
          <button type="button" class="col-span-2 flex items-center justify-center gap-2 rounded-lg bg-accent py-2.5 text-sm font-semibold text-accent-ink hover:brightness-110" @click="showOnMap">
            <Icon name="map" :size="16" /> {{ t('photo.onMap') }}
          </button>
          <button type="button" class="flex items-center justify-center gap-1.5 rounded-lg border border-rule bg-card py-2 text-[13px] hover:bg-paper-2" :class="fav && 'text-accent'" @click="store.toggleFav(photo)">
            <Icon name="star" :size="15" :filled="fav" /> {{ fav ? t('photo.unsave') : t('photo.save') }}
          </button>
          <button type="button" class="flex items-center justify-center gap-1.5 rounded-lg border border-rule bg-card py-2 text-[13px] hover:bg-paper-2" @click="dl.copyLink(photo)">
            <Icon name="link" :size="15" /> {{ t('photo.copyLink') }}
          </button>
          <a :href="photoUrl(photo, 'original', { download: true })" class="flex items-center justify-center gap-1.5 rounded-lg border border-rule bg-card py-2 text-[13px] hover:bg-paper-2">
            <Icon name="download" :size="15" /> {{ t('photo.download') }}
          </a>
          <a :href="sourceUrl(photo)" target="_blank" rel="noopener" class="flex items-center justify-center gap-1.5 rounded-lg border border-rule bg-card py-2 text-[13px] hover:bg-paper-2">
            <Icon name="external" :size="15" /> {{ t('photo.source') }}
          </a>
        </div>

        <dl class="m-5 divide-y divide-rule rounded-xl border border-rule text-sm">
          <div v-for="[k, val] in meta" :key="k" class="flex justify-between gap-4 px-3 py-2">
            <dt class="text-ink-3">{{ k }}</dt>
            <dd class="truncate text-right font-mono text-[12.5px]">{{ val }}</dd>
          </div>
        </dl>

        <p class="mt-auto px-5 pb-5 text-[11px] leading-relaxed text-ink-3">
          {{ t('photo.zoomHint') }}<br>← → · M · S · Esc<br><br>{{ t('credit') }}
        </p>
      </aside>
    </div>
  </Transition>
</template>

<style scoped>
.viewer-enter-active, .viewer-leave-active { transition: opacity .2s; }
.viewer-enter-from, .viewer-leave-to { opacity: 0; }
</style>
