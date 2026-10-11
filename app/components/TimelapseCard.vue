<script setup lang="ts">
import { buildFrames, type Frame, frameUrl } from '~/utils/timelapse'

const store = useFototeca()
const { t } = useI18n()

const point = computed(() => store.area.value?.point ?? null)
const frames = shallowRef<Frame[]>([])
let abort: AbortController | null = null

watch(point, async (p) => {
  abort?.abort()
  frames.value = []
  if (!p) return
  const ctrl = abort = new AbortController()
  try {
    const f = await buildFrames(p, ctrl.signal)
    if (!ctrl.signal.aborted) frames.value = f
  }
  catch { /* the card simply stays hidden */ }
}, { immediate: true })

const photoFrames = computed(() => frames.value.filter(f => f.kind === 'photo'))
// A few frames spread across the whole span
const preview = computed(() => {
  const f = frames.value
  if (f.length <= 5) return f
  return [0, 0.25, 0.5, 0.75, 1].map(r => f[Math.round(r * (f.length - 1))]!)
})
</script>

<template>
  <section v-if="point && photoFrames.length" class="rise overflow-hidden rounded-2xl border border-rule bg-card">
    <div class="flex gap-1 p-1.5">
      <img
        v-for="f in preview"
        :key="f.id"
        :src="frameUrl(f, point, 1200)"
        alt=""
        loading="lazy"
        class="aspect-square min-w-0 flex-1 rounded-lg bg-paper-2 object-cover"
      >
    </div>
    <div class="flex items-center justify-between gap-3 px-3.5 pb-3 pt-1.5">
      <div class="min-w-0">
        <p class="text-sm font-semibold">{{ t('tl.cardTitle') }}</p>
        <p class="truncate text-xs text-ink-3">
          {{ t('tl.summary', { n: photoFrames.length, from: frames[0]!.year, to: frames[frames.length - 1]!.year }) }}
        </p>
      </div>
      <button
        type="button"
        class="flex shrink-0 items-center gap-1.5 rounded-full bg-accent px-3.5 py-2 text-[13px] font-semibold text-accent-ink hover:brightness-110"
        @click="store.openTimelapse(point, store.area.value?.label)"
      >
        <svg viewBox="0 0 24 24" class="size-3.5" fill="currentColor"><path d="M7 4.5v15l13-7.5z" /></svg>
        {{ t('tl.open') }}
      </button>
    </div>
  </section>
</template>
