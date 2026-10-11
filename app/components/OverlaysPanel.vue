<script setup lang="ts">
import { unionBbox } from '~/utils/geo'
import { photoUrl } from '~/utils/photoUrl'
import { formatDate, formatScale } from '~/utils/format'

const store = useFototeca()
const { t, lang } = useI18n()
const dl = useDownloads()

// Show top-most first
const list = computed(() => [...store.overlays.value].reverse())
const photos = computed(() => store.overlays.value.map(o => o.photo))

function fitAll() {
  const b = unionBbox(photos.value.map(p => p.bbox))
  if (b) store.fitBbox(b)
}

function setAllOpacity(v: number) {
  store.overlays.value.forEach(o => (o.opacity = v))
}
const avgOpacity = computed(() => store.overlays.value.length
  ? store.overlays.value.reduce((s, o) => s + o.opacity, 0) / store.overlays.value.length
  : 1)
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <h2 class="text-[17px] font-semibold tracking-tight">{{ t('map.title') }}</h2>
      <span class="edge-print text-ink-3">{{ store.overlays.value.length }}</span>
    </div>

    <label class="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-rule bg-card px-3 py-2.5">
      <span class="text-sm">{{ t('map.cleanEdges') }}</span>
      <input v-model="store.cleanEdges.value" type="checkbox" class="peer sr-only">
      <span class="relative h-5 w-9 shrink-0 rounded-full bg-rule transition peer-checked:bg-accent peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--focus)] after:absolute after:left-0.5 after:top-0.5 after:size-4 after:rounded-full after:bg-card after:shadow after:transition peer-checked:after:translate-x-4" />
    </label>

    <p v-if="!store.overlays.value.length" class="rounded-xl border border-dashed border-rule p-5 text-sm leading-relaxed text-ink-3">
      {{ t('map.empty') }}
    </p>

    <template v-else>
      <div class="rounded-xl border border-rule bg-card px-3 py-2.5">
        <div class="mb-1 flex justify-between text-xs text-ink-3">
          <span>{{ t('map.opacity') }}</span><span class="font-mono">{{ Math.round(avgOpacity * 100) }}%</span>
        </div>
        <input
          type="range" class="range" min="0" max="1" step="0.05" :value="avgOpacity"
          :style="{ '--pct': `${avgOpacity * 100}%` }" :aria-label="t('map.opacity')"
          @input="setAllOpacity(Number(($event.target as HTMLInputElement).value))"
        >
      </div>

      <div class="flex flex-wrap gap-1.5">
        <button type="button" class="flex items-center gap-1 rounded-lg border border-rule px-2.5 py-1.5 text-xs text-ink-2 hover:border-ink-3 hover:text-ink" @click="fitAll">
          <Icon name="fit" :size="14" /> {{ t('map.fit') }}
        </button>
        <button type="button" class="flex items-center gap-1 rounded-lg border border-rule px-2.5 py-1.5 text-xs text-ink-2 hover:border-ink-3 hover:text-ink" @click="dl.downloadZip(photos, 'geoportugal_mapa')">
          <Icon name="download" :size="14" /> {{ t('map.zip') }}
        </button>
        <button type="button" class="flex items-center gap-1 rounded-lg border border-rule px-2.5 py-1.5 text-xs text-ink-2 hover:border-ink-3 hover:text-ink" :title="t('results.mosaicHint')" @click="dl.downloadMosaic(photos, 'geoportugal_mosaico')">
          <Icon name="globe" :size="14" /> {{ t('map.mosaic') }}
        </button>
        <button type="button" class="ml-auto flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs text-ink-3 hover:text-accent" @click="store.clearOverlays()">
          <Icon name="trash" :size="14" /> {{ t('map.clear') }}
        </button>
      </div>

      <ul class="space-y-1.5">
        <li
          v-for="o in list"
          :key="o.photo.uid"
          class="rise flex gap-3 rounded-xl border border-rule bg-card p-2"
          @mouseenter="store.hovered.value = o.photo.uid"
          @mouseleave="store.hovered.value = null"
        >
          <button type="button" class="size-16 shrink-0 overflow-hidden rounded-lg bg-paper-2" :aria-label="t('photo.open')" @click="store.openViewer(photos, photos.indexOf(o.photo))">
            <img :src="photoUrl(o.photo, 'thumb', { trim: true })" alt="" loading="lazy" class="size-full scale-110 object-cover" :class="!o.visible && 'opacity-30'">
          </button>
          <div class="min-w-0 flex-1">
            <div class="flex items-start justify-between gap-2">
              <div class="min-w-0">
                <p class="truncate text-sm font-medium">{{ formatDate(o.photo.date, lang, 'short') }}</p>
                <p class="edge-print truncate text-ink-3">{{ o.photo.rolo }} · {{ o.photo.foto }} · {{ formatScale(o.photo.scale, lang) }}</p>
              </div>
              <div class="flex shrink-0">
                <button type="button" class="grid size-7 place-items-center rounded-md text-ink-3 hover:bg-paper-2 hover:text-ink" :aria-label="t('map.fit')" :title="t('map.fit')" @click="store.fitBbox(o.photo.bbox)">
                  <Icon name="fit" :size="15" />
                </button>
                <button type="button" class="grid size-7 place-items-center rounded-md text-ink-3 hover:bg-paper-2 hover:text-ink" :aria-label="o.visible ? 'Hide' : 'Show'" :aria-pressed="!o.visible" @click="o.visible = !o.visible">
                  <Icon :name="o.visible ? 'eye' : 'eyeOff'" :size="15" />
                </button>
                <button type="button" class="grid size-7 place-items-center rounded-md text-ink-3 hover:bg-paper-2 hover:text-accent" :aria-label="t('photo.removeMap')" @click="store.removeOverlay(o.photo.uid)">
                  <Icon name="close" :size="15" />
                </button>
              </div>
            </div>
            <input
              v-model.number="o.opacity" type="range" class="range mt-1" min="0" max="1" step="0.05"
              :style="{ '--pct': `${o.opacity * 100}%` }" :aria-label="t('map.opacity')"
            >
          </div>
        </li>
      </ul>
    </template>
  </div>
</template>
