<script setup lang="ts">
import type { Photo } from '~/utils/types'
import { flightKey, formatCount, formatDate, formatScale } from '~/utils/format'
import { yearColor } from '~/utils/colors'

const store = useFototeca()
const { t, lang } = useI18n()
const { isDark } = useTheme()
const dl = useDownloads()

interface Group { key: string, date: string | null, year: number | null, rolo: string, scale: number | null, work: string, photos: Photo[] }

const groups = computed<Group[]>(() => {
  const out = new Map<string, Group>()
  for (const p of store.photos.value) {
    const k = flightKey(p)
    let g = out.get(k)
    if (!g) out.set(k, g = { key: k, date: p.date, year: p.year, rolo: p.rolo, scale: p.scale, work: p.work, photos: [] })
    g.photos.push(p)
  }
  return [...out.values()]
})

const selectedPhotos = computed(() => store.photos.value.filter(p => store.selected.value.includes(p.uid)))
const indexOf = (p: Photo) => store.photos.value.indexOf(p)
const allOnMap = (g: Group) => g.photos.every(p => store.overlayUids.value.has(p.uid))

function toggleGroupOnMap(g: Group) {
  if (allOnMap(g)) g.photos.forEach(p => store.removeOverlay(p.uid))
  else store.addOverlays(g.photos)
}

const fileName = computed(() => `geoportugal_${(store.area.value?.label ?? 'area').split(',')[0]!.toLowerCase().replace(/[^\p{L}\d]+/gu, '-')}`)
</script>

<template>
  <section>
    <!-- header -->
    <div class="sticky top-0 z-10 -mx-5 flex items-center justify-between gap-2 border-b border-rule bg-card px-5 py-2.5">
      <div class="min-w-0">
        <p class="text-sm font-semibold">
          <template v-if="store.photosState.value === 'loading'">…</template>
          <template v-else>{{ t('results.count', { n: formatCount(store.total.value, lang) }) }}</template>
        </p>
        <p v-if="store.total.value > store.photos.value.length && store.photosState.value !== 'loading'" class="text-[11px] text-ink-3">
          {{ t('results.showing', { n: formatCount(store.photos.value.length, lang) }) }}
        </p>
      </div>
      <div class="flex items-center gap-1.5">
        <button
          type="button"
          class="grid size-8 place-items-center rounded-lg border border-rule text-ink-2 hover:border-ink-3 hover:text-ink"
          :title="store.newestFirst.value ? t('results.newest') : t('results.oldest')"
          :aria-label="store.newestFirst.value ? t('results.newest') : t('results.oldest')"
          @click="store.newestFirst.value = !store.newestFirst.value"
        >
          <Icon name="sort" :size="16" :class="store.newestFirst.value ? 'rotate-180' : ''" class="transition" />
        </button>
        <MenuButton :label="t('results.export')" :class="!store.photos.value.length && 'pointer-events-none opacity-50'">
          <MenuItem icon="file" @click="dl.exportFile('geojson', store.photos.value, fileName)">{{ t('export.geojson') }}</MenuItem>
          <MenuItem icon="globe" @click="dl.exportFile('kml', store.photos.value, fileName)">{{ t('export.kml') }}</MenuItem>
          <MenuItem icon="file" @click="dl.exportFile('csv', store.photos.value, fileName)">{{ t('export.csv') }}</MenuItem>
        </MenuButton>
      </div>
    </div>

    <!-- selection bar -->
    <div v-if="store.selected.value.length" class="rise sticky top-[57px] z-10 -mx-2 mt-2 flex items-center gap-1 rounded-xl bg-accent px-3 py-2 text-accent-ink shadow-panel">
      <span class="mr-auto text-sm font-medium">{{ t('results.selected', { n: store.selected.value.length }) }}</span>
      <button type="button" class="flex items-center gap-1 rounded-md px-2 py-1 text-xs hover:bg-paper/15" @click="store.addOverlays(selectedPhotos)">
        <Icon name="map" :size="14" /> {{ t('results.addMap') }}
      </button>
      <button type="button" class="flex items-center gap-1 rounded-md px-2 py-1 text-xs hover:bg-paper/15" @click="dl.downloadZip(selectedPhotos, fileName)">
        <Icon name="download" :size="14" /> ZIP
      </button>
      <button type="button" class="grid size-7 place-items-center rounded-md hover:bg-paper/15" :aria-label="t('results.clearSel')" @click="store.selected.value = []">
        <Icon name="close" :size="14" />
      </button>
    </div>

    <!-- error -->
    <div v-if="store.photosState.value === 'error'" class="mt-4 rounded-xl border border-accent/40 bg-accent-soft p-4 text-sm">
      <p>{{ t('results.error') }}</p>
      <button type="button" class="mt-2 font-semibold text-accent underline" @click="store.loadPhotos()">{{ t('results.retry') }}</button>
    </div>

    <!-- skeleton -->
    <div v-else-if="store.photosState.value === 'loading'" class="mt-4 grid grid-cols-4 gap-2">
      <div v-for="i in 12" :key="i" class="aspect-square animate-pulse rounded-lg bg-paper-2" :style="{ animationDelay: `${i * 60}ms` }" />
    </div>

    <!-- flights -->
    <div v-else class="mt-3 space-y-5">
      <article v-for="g in groups" :key="g.key">
        <header class="mb-2 flex items-start justify-between gap-2">
          <div class="flex min-w-0 items-start gap-2.5">
            <span class="mt-1.5 size-2.5 shrink-0 rounded-full" :style="{ background: yearColor(g.year, isDark) }" />
            <div class="min-w-0">
            <h4 class="truncate text-[15px] font-semibold leading-tight">{{ formatDate(g.date, lang) }}</h4>
            <p class="edge-print mt-0.5 truncate text-ink-3">
              {{ t('results.flight', { rolo: g.rolo }) }} · {{ formatScale(g.scale, lang) }}<template v-if="g.work"> · {{ g.work }}</template> · {{ g.photos.length }}
            </p>
            </div>
          </div>
          <button
            type="button"
            class="mt-0.5 flex shrink-0 items-center gap-1 rounded-md border px-2 py-1 text-[11px] transition"
            :class="allOnMap(g) ? 'border-accent bg-accent text-accent-ink' : 'border-rule text-ink-2 hover:border-ink-3 hover:text-ink'"
            :aria-pressed="allOnMap(g)"
            @click="toggleGroupOnMap(g)"
          >
            <Icon name="map" :size="13" /> {{ allOnMap(g) ? t('photo.removeMap') : t('results.addMap') }}
          </button>
        </header>
        <div class="grid grid-cols-4 gap-2">
          <PhotoCard v-for="p in g.photos" :key="p.uid" :photo="p" :list="store.photos.value" :index="indexOf(p)" selectable />
        </div>
      </article>

      <button
        v-if="store.photos.value.length < store.total.value"
        type="button"
        class="w-full rounded-xl border border-dashed border-rule py-3 text-sm font-medium text-ink-2 hover:border-ink-3 hover:text-ink disabled:opacity-60"
        :disabled="store.photosState.value === 'more'"
        @click="store.loadPhotos(true)"
      >
        {{ store.photosState.value === 'more' ? '…' : t('results.more') }}
      </button>
    </div>
  </section>
</template>
