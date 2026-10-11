<script setup lang="ts">
import type { PhotoLocation } from '~/utils/types'
import { buildFrames, type Frame, frameUrl } from '~/utils/timelapse'
import { formatDate, formatScale } from '~/utils/format'

const store = useFototeca()
const { t, lang } = useI18n()
const dl = useDownloads()

const tl = computed(() => store.timelapse.value)
const frames = shallowRef<Frame[]>([])
const state = ref<'loading' | 'ready' | 'error'>('loading')
const index = ref(0)
const playing = ref(false)
const size = ref(1200)
const where = ref('')
const loaded = reactive(new Set<string>())

const SIZES = [300, 600, 1200, 2500]
let abort: AbortController | null = null

watch(tl, async (v) => {
  abort?.abort()
  playing.value = false
  frames.value = []
  loaded.clear()
  where.value = ''
  if (!v) return
  index.value = 0
  state.value = 'loading'
  const ctrl = abort = new AbortController()
  $fetch<PhotoLocation>('/api/locate', { query: { lon: v.point[0], lat: v.point[1] } })
    .then((loc) => { if (loc.parish && tl.value === v) where.value = `${loc.parish.name}, ${loc.municipality}` })
    .catch(() => {})
  try {
    frames.value = await buildFrames(v.point, ctrl.signal)
    if (ctrl.signal.aborted) return
    state.value = 'ready'
  }
  catch (e) {
    if (ctrl.signal.aborted) return
    console.error(e)
    state.value = 'error'
  }
}, { immediate: true })

watch(size, () => loaded.clear())

const frame = computed(() => frames.value[index.value])
const url = (f: Frame) => frameUrl(f, tl.value!.point, size.value)
const photoCount = computed(() => frames.value.filter(f => f.kind === 'photo').length)

// playback -----------------------------------------------------------------------
let timer: ReturnType<typeof setInterval> | undefined
watch(playing, (p) => {
  clearInterval(timer)
  if (p) timer = setInterval(() => go(1, true), 1400)
})
onBeforeUnmount(() => clearInterval(timer))

function go(d: number, wrap = false) {
  const n = frames.value.length
  if (!n) return
  let i = index.value + d
  if (wrap) i = (i + n) % n
  index.value = Math.min(Math.max(i, 0), n - 1)
}

function close() {
  store.timelapse.value = null
}

function onKey(e: KeyboardEvent) {
  if (!tl.value || store.viewer.value) return
  if ((e.target as HTMLElement)?.tagName === 'INPUT') return
  if (e.key === 'Escape') close()
  else if (e.key === 'ArrowLeft') { playing.value = false; go(-1) }
  else if (e.key === 'ArrowRight') { playing.value = false; go(1) }
  else if (e.key === ' ') playing.value = !playing.value
  else return
  e.preventDefault()
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))

// timeline axis --------------------------------------------------------------------
const axis = computed<[number, number]>(() => {
  const first = frames.value[0]?.year ?? 1944
  return [Math.min(1940, first), 2025]
})
function xOf(f: Frame) {
  const [a, b] = axis.value
  const [y, m] = f.date.split('-').map(Number)
  return ((y! + ((m ?? 6) - 1) / 12 - a) / (b - a)) * 100
}
const ticks = computed(() => {
  const out: number[] = []
  for (let y = Math.ceil(axis.value[0] / 10) * 10; y <= axis.value[1]; y += 10) out.push(y)
  return out
})

function onAxis(e: PointerEvent) {
  const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
  const pct = ((e.clientX - r.left) / r.width) * 100
  let best = 0, bestD = Infinity
  frames.value.forEach((f, i) => {
    const d = Math.abs(xOf(f) - pct)
    if (d < bestD) { bestD = d; best = i }
  })
  playing.value = false
  index.value = best
}

// filmstrip follows the current frame
const strip = ref<HTMLElement>()
watch(index, async (i) => {
  await nextTick()
  strip.value?.children[i]?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
})

// labels ---------------------------------------------------------------------------
function title(f: Frame) {
  return f.kind === 'ortho' ? String(f.year) : formatDate(f.date, lang.value)
}
function subtitle(f: Frame) {
  if (f.kind === 'ortho') return f.year === 2023 ? t('tl.sat') : t('tl.ortho')
  const p = f.photo!
  return `${t('tl.photo')} · ${formatScale(p.scale, lang.value)} · ${t('results.flight', { rolo: p.rolo })}`
}

function showOnMap(f: Frame) {
  if (!f.photo) return
  store.addOverlays([f.photo])
  store.fitBbox(f.photo.bbox, { maxZoom: 15 })
  store.tab.value = 'map'
  close()
}

function sizeLabel(m: number) {
  return m >= 1000 ? `${(m / 1000).toLocaleString(lang.value === 'pt' ? 'pt-PT' : 'en-GB')} km` : `${m} m`
}
</script>

<template>
  <Transition name="tl">
    <div v-if="tl" class="fixed inset-0 z-40 overflow-y-auto bg-paper/95 backdrop-blur-md" role="dialog" aria-modal="true" :aria-label="t('tl.title')">
      <div class="mx-auto flex min-h-full max-w-[1180px] flex-col gap-5 p-4 md:p-8">
        <!-- header -->
        <header class="flex items-start justify-between gap-4">
          <div class="min-w-0">
            <p class="text-xs font-medium text-accent">{{ t('tl.title') }}</p>
            <h2 class="mt-0.5 truncate text-[22px] font-semibold tracking-tight">{{ where || tl.label || `${tl.point[1].toFixed(4)}, ${tl.point[0].toFixed(4)}` }}</h2>
            <p v-if="state === 'ready' && frames.length" class="text-sm text-ink-3">
              {{ t('tl.summary', { n: photoCount, from: frames[0]!.year, to: frames[frames.length - 1]!.year }) }}
            </p>
          </div>
          <div class="flex shrink-0 items-center gap-1.5">
            <button type="button" class="flex h-9 items-center gap-1.5 rounded-lg border border-rule bg-card px-3 text-[13px] hover:bg-paper-2" @click="dl.copyLink()">
              <Icon name="link" :size="15" /> <span class="hidden sm:inline">{{ t('photo.copyLink') }}</span>
            </button>
            <button type="button" class="grid size-9 place-items-center rounded-full border border-rule bg-card shadow-sm hover:bg-paper-2" aria-label="Close" @click="close">
              <Icon name="close" />
            </button>
          </div>
        </header>

        <div v-if="state === 'loading'" class="grid flex-1 place-items-center py-24">
          <span class="size-8 animate-spin rounded-full border-2 border-rule border-t-accent" />
        </div>
        <p v-else-if="state === 'error'" class="py-24 text-center text-ink-3">{{ t('results.error') }}</p>
        <p v-else-if="!frames.length" class="py-24 text-center text-ink-3">{{ t('tl.empty') }}</p>

        <template v-else>
          <div class="grid gap-6 md:grid-cols-[minmax(0,1fr)_300px]">
            <!-- stage -->
            <div class="relative mx-auto aspect-square w-full max-w-[min(640px,68vh)] overflow-hidden rounded-2xl bg-paper-2 shadow-panel">
              <img
                v-for="(f, i) in frames"
                :key="`${f.id}-${size}`"
                :src="url(f)"
                alt=""
                class="absolute inset-0 size-full object-cover transition-opacity duration-500"
                :class="i === index ? 'opacity-100' : 'opacity-0'"
                @load="loaded.add(`${f.id}-${size}`)"
              >
              <div v-if="frame && !loaded.has(`${frame.id}-${size}`)" class="absolute inset-0 grid place-items-center">
                <span class="size-7 animate-spin rounded-full border-2 border-white/40 border-t-accent" />
              </div>
              <!-- the spot -->
              <span class="pointer-events-none absolute left-1/2 top-1/2 size-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgb(0_0_0/.35)]" />
              <span class="absolute bottom-3 left-3 rounded-full bg-black/55 px-3 py-1 text-[13px] font-semibold tabular-nums text-white backdrop-blur">
                {{ frame?.year }}
              </span>
            </div>

            <!-- info -->
            <aside v-if="frame" class="flex flex-col gap-4">
              <div>
                <p class="text-[28px] font-semibold leading-tight tracking-tight">{{ title(frame) }}</p>
                <p class="mt-1 text-sm text-ink-2">{{ subtitle(frame) }}</p>
              </div>

              <div class="flex items-center gap-1.5">
                <button type="button" class="grid size-10 place-items-center rounded-full border border-rule bg-card hover:bg-paper-2 disabled:opacity-40" :disabled="index === 0" aria-label="Previous" @click="playing = false; go(-1)">
                  <Icon name="chevronLeft" />
                </button>
                <button type="button" class="flex h-10 flex-1 items-center justify-center gap-2 rounded-full bg-accent text-sm font-semibold text-accent-ink hover:brightness-110" @click="playing = !playing">
                  <svg v-if="!playing" viewBox="0 0 24 24" class="size-4" fill="currentColor"><path d="M7 4.5v15l13-7.5z" /></svg>
                  <svg v-else viewBox="0 0 24 24" class="size-4" fill="currentColor"><path d="M6 4h4v16H6zM14 4h4v16h-4z" /></svg>
                  {{ playing ? t('tl.pause') : t('tl.play') }}
                </button>
                <button type="button" class="grid size-10 place-items-center rounded-full border border-rule bg-card hover:bg-paper-2 disabled:opacity-40" :disabled="index === frames.length - 1" aria-label="Next" @click="playing = false; go(1)">
                  <Icon name="chevronRight" />
                </button>
              </div>

              <div>
                <p class="mb-1.5 text-xs font-medium text-ink-3">{{ t('tl.size') }}</p>
                <div class="grid grid-cols-4 gap-1 rounded-xl bg-paper-2 p-1">
                  <button
                    v-for="m in SIZES"
                    :key="m"
                    type="button"
                    class="rounded-lg py-1.5 text-[12.5px] font-medium tabular-nums transition"
                    :class="size === m ? 'bg-card text-ink shadow-sm' : 'text-ink-3 hover:text-ink-2'"
                    @click="size = m"
                  >
                    {{ sizeLabel(m) }}
                  </button>
                </div>
              </div>

              <div v-if="frame.photo" class="grid grid-cols-2 gap-1.5">
                <button type="button" class="flex items-center justify-center gap-1.5 rounded-lg border border-rule bg-card py-2 text-[13px] hover:bg-paper-2" @click="store.openViewer([frame.photo!], 0)">
                  <Icon name="image" :size="15" /> {{ t('photo.open') }}
                </button>
                <button type="button" class="flex items-center justify-center gap-1.5 rounded-lg border border-rule bg-card py-2 text-[13px] hover:bg-paper-2" @click="showOnMap(frame)">
                  <Icon name="map" :size="15" /> {{ t('photo.onMap') }}
                </button>
              </div>

              <p class="mt-auto text-[11.5px] leading-relaxed text-ink-3">{{ t('tl.note') }}<br>← → · {{ t('tl.space') }} · Esc</p>
            </aside>
          </div>

          <!-- proportional timeline -->
          <div class="select-none">
            <div class="relative h-9 cursor-pointer" @pointerdown="onAxis">
              <div class="absolute inset-x-0 top-1/2 h-px bg-rule" />
              <span
                v-for="(f, i) in frames"
                :key="f.id"
                class="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full transition-all"
                :class="[
                  i === index ? 'size-4 bg-accent ring-4 ring-accent/20' : 'size-2.5',
                  i !== index && (f.kind === 'ortho' ? 'bg-ink-3' : 'bg-ink-2'),
                ]"
                :style="{ left: `${xOf(f)}%` }"
                :title="`${title(f)} — ${subtitle(f)}`"
              />
            </div>
            <div class="relative h-4 text-[11px] tabular-nums text-ink-3">
              <span v-for="y in ticks" :key="y" class="absolute -translate-x-1/2" :style="{ left: `${((y - axis[0]) / (axis[1] - axis[0])) * 100}%` }">{{ y }}</span>
            </div>
          </div>

          <!-- filmstrip -->
          <div ref="strip" class="scroll-thin -mx-1 flex gap-2 overflow-x-auto px-1 pb-2">
            <button
              v-for="(f, i) in frames"
              :key="f.id"
              type="button"
              class="group shrink-0 text-left"
              @click="playing = false; index = i"
            >
              <span class="block size-[76px] overflow-hidden rounded-lg bg-paper-2 ring-offset-2 ring-offset-paper transition" :class="i === index ? 'ring-2 ring-accent' : 'opacity-75 group-hover:opacity-100'">
                <img :src="url(f)" alt="" loading="lazy" class="size-full object-cover">
              </span>
              <span class="mt-1 block text-center text-[11px] font-medium tabular-nums" :class="i === index ? 'text-accent' : 'text-ink-3'">{{ f.year }}</span>
            </button>
          </div>
        </template>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.tl-enter-active, .tl-leave-active { transition: opacity .2s; }
.tl-enter-from, .tl-leave-to { opacity: 0; }
</style>
