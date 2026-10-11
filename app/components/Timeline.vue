<script setup lang="ts">
import { yearColor } from '~/utils/colors'
import { formatCount } from '~/utils/format'

const store = useFototeca()
const { t, lang } = useI18n()
const { isDark } = useTheme()

const wrap = ref<HTMLDivElement>()
const width = ref(360)
const H = 88
const AXIS = 18

let ro: ResizeObserver | undefined
onMounted(() => {
  ro = new ResizeObserver(([e]) => { width.value = Math.max(200, e!.contentRect.width) })
  ro.observe(wrap.value!)
})
onBeforeUnmount(() => ro?.disconnect())

const domain = computed<[number, number]>(() => {
  const d = store.dataYears.value
  if (!d) return [1944, 2000]
  // always show at least a decade of context
  const pad = Math.max(0, Math.ceil((10 - (d[1] - d[0])) / 2))
  return [d[0] - pad, d[1] + pad]
})

const bars = computed(() => {
  const [a, b] = domain.value
  const n = b - a + 1
  const step = width.value / n
  const gap = step > 6 ? 2 : step > 3 ? 1 : 0
  const max = Math.max(1, ...store.yearCounts.value.values())
  return Array.from({ length: n }, (_, i) => {
    const year = a + i
    const count = store.yearCounts.value.get(year) ?? 0
    const h = count ? Math.max(3, (count / max) * (H - 6)) : 0
    return { year, count, x: i * step + gap / 2, w: Math.max(1, step - gap), h }
  })
})

const maxCount = computed(() => Math.max(0, ...store.yearCounts.value.values()))

const ticks = computed(() => {
  const [a, b] = domain.value
  const span = b - a
  const every = span > 40 ? 10 : span > 16 ? 5 : span > 8 ? 2 : 1
  const out: number[] = []
  for (let y = Math.ceil(a / every) * every; y <= b; y += every) out.push(y)
  return out
})

const xOf = (year: number) => {
  const [a, b] = domain.value
  return ((year - a + 0.5) / (b - a + 1)) * width.value
}

function yearAt(clientX: number) {
  const r = wrap.value!.getBoundingClientRect()
  const [a, b] = domain.value
  const y = a + Math.floor(((clientX - r.left) / r.width) * (b - a + 1))
  return Math.min(Math.max(y, a), b)
}

const inRange = (y: number) => y >= store.years.value[0] && y <= store.years.value[1]
const isFull = computed(() => {
  const d = store.dataYears.value
  return !d || (store.years.value[0] <= d[0] && store.years.value[1] >= d[1])
})

// Brush ----------------------------------------------------------------------
const hover = ref<{ year: number, count: number } | null>(null)
let brushStart: number | null = null
let moved = false

function onDown(e: PointerEvent) {
  if (!store.summary.value.length) return
  ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
  brushStart = yearAt(e.clientX)
  moved = false
}

function onMove(e: PointerEvent) {
  const y = yearAt(e.clientX)
  hover.value = { year: y, count: store.yearCounts.value.get(y) ?? 0 }
  if (brushStart == null) return
  if (y !== brushStart) moved = true
  if (moved) store.years.value = [Math.min(brushStart, y), Math.max(brushStart, y)]
}

function onUp(e: PointerEvent) {
  if (brushStart == null) return
  const y = yearAt(e.clientX)
  if (!moved) {
    const single = store.years.value[0] === y && store.years.value[1] === y
    if (single) store.resetYears()
    else store.years.value = [y, y]
  }
  brushStart = null
}

function onKey(e: KeyboardEvent) {
  const d = store.dataYears.value
  if (!d) return
  const [a, b] = store.years.value
  if (e.key === 'ArrowLeft') store.years.value = [Math.max(d[0], a - 1), Math.max(d[0], b - 1)]
  else if (e.key === 'ArrowRight') store.years.value = [Math.min(d[1], a + 1), Math.min(d[1], b + 1)]
  else if (e.key === 'Escape') store.resetYears()
  else return
  e.preventDefault()
}

const tipLeft = computed(() => hover.value ? Math.min(Math.max(xOf(hover.value.year), 50), width.value - 50) : 0)
</script>

<template>
  <section>
    <div class="mb-2 flex items-end justify-between gap-2">
      <div>
        <h3 class="text-xs font-medium text-ink-3">{{ t('timeline.title') }}</h3>
        <p class="mt-1 text-[24px] font-semibold leading-none tracking-tight tabular-nums">
          <template v-if="store.summaryState.value === 'loading'">
            <span class="inline-block h-7 w-36 animate-pulse rounded bg-paper-2 align-middle" />
          </template>
          <template v-else-if="store.summary.value.length">
            {{ store.years.value[0] }}<template v-if="store.years.value[1] !== store.years.value[0]">
              <span class="text-ink-3"> – </span>{{ store.years.value[1] }}
            </template>
          </template>
          <template v-else>—</template>
        </p>
      </div>
      <button
        v-if="!isFull"
        type="button"
        class="rounded-full border border-rule px-2.5 py-1 text-xs text-ink-2 hover:border-ink-3 hover:text-ink"
        @click="store.resetYears()"
      >
        {{ t('timeline.reset') }}
      </button>
    </div>

    <div
      ref="wrap"
      class="relative select-none outline-none"
      :class="store.summary.value.length ? 'cursor-col-resize' : ''"
      tabindex="0"
      role="group"
      :aria-label="`${t('timeline.title')}: ${store.years.value[0]}–${store.years.value[1]}`"
      @pointerdown="onDown"
      @pointermove="onMove"
      @pointerup="onUp"
      @pointerleave="hover = null"
      @keydown="onKey"
    >
      <svg :width="width" :height="H + AXIS" class="block overflow-visible">
        <!-- baseline -->
        <line x1="0" :x2="width" :y1="H + 0.5" :y2="H + 0.5" stroke="var(--rule)" />
        <!-- selected range band -->
        <rect
          v-if="store.summary.value.length && !isFull"
          :x="xOf(store.years.value[0]) - (width / (domain[1] - domain[0] + 1)) / 2"
          :width="(store.years.value[1] - store.years.value[0] + 1) * (width / (domain[1] - domain[0] + 1))"
          y="0" :height="H" fill="var(--accent-soft)" rx="3"
        />
        <!-- bars, rounded at the data end -->
        <g v-if="store.summaryState.value !== 'loading'">
          <path
            v-for="b in bars"
            v-show="b.h > 0"
            :key="b.year"
            :d="`M${b.x},${H} v${-(b.h - Math.min(2, b.w / 2))} q0,${-Math.min(2, b.w / 2)} ${Math.min(2, b.w / 2)},${-Math.min(2, b.w / 2)} h${b.w - 2 * Math.min(2, b.w / 2)} q${Math.min(2, b.w / 2)},0 ${Math.min(2, b.w / 2)},${Math.min(2, b.w / 2)} v${b.h - Math.min(2, b.w / 2)} z`"
            :fill="inRange(b.year) ? yearColor(b.year, isDark) : 'var(--rule)'"
            :opacity="hover && hover.year === b.year ? 1 : inRange(b.year) ? 0.92 : 0.8"
          />
        </g>
        <g v-else>
          <rect v-for="i in 18" :key="i" :x="(i - 1) * (width / 18) + 2" :y="H - 12 - ((i * 37) % 50)" :width="width / 18 - 4" :height="12 + ((i * 37) % 50)" fill="var(--paper-2)" rx="2" class="animate-pulse" />
        </g>
        <!-- hover guide -->
        <line v-if="hover" :x1="xOf(hover.year)" :x2="xOf(hover.year)" y1="0" :y2="H" stroke="var(--ink-3)" stroke-dasharray="2 3" />
        <!-- axis -->
        <g class="edge-print" fill="var(--ink-3)">
          <text v-for="y in ticks" :key="y" :x="xOf(y)" :y="H + 14" text-anchor="middle">{{ y }}</text>
        </g>
        <text v-if="maxCount" x="0" y="9" class="edge-print" fill="var(--ink-3)">{{ formatCount(maxCount, lang) }}</text>
      </svg>

      <div
        v-if="hover"
        class="pointer-events-none absolute -top-9 z-10 -translate-x-1/2 whitespace-nowrap rounded-md bg-ink px-2 py-1 text-xs text-paper shadow-lg"
        :style="{ left: `${tipLeft}px` }"
      >
        <b class="font-semibold">{{ hover.year }}</b> · {{ t('timeline.photos', { n: formatCount(hover.count, lang) }) }}
      </div>
    </div>

    <p v-if="store.summaryState.value === 'ready' && !store.summary.value.length" class="mt-2 text-sm text-ink-3">
      {{ t('timeline.empty') }}
    </p>
    <p v-else-if="store.summary.value.length" class="mt-1 text-[11px] text-ink-3">{{ t('timeline.hint') }}</p>
  </section>
</template>
