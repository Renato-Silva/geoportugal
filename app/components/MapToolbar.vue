<script setup lang="ts">
import { ORTHO_YEARS, type BasemapId, type OrthoYear } from '~/composables/useFototeca'
import { COS_IDS, THEMATIC_LAYERS, thematicLegendUrl } from '#shared/thematic'

const emit = defineEmits<{ exportPng: [] }>()
const store = useFototeca()
const { t } = useI18n()
const cartaMilitarEnabled = useRuntimeConfig().public.cartaMilitarEnabled as boolean

const basemaps = computed<{ id: BasemapId, label: string, swatch: string }[]>(() => [
  { id: 'map', label: t('basemap.map'), swatch: 'linear-gradient(135deg,#f4f5f7,#d9dde3)' },
  { id: 'osm', label: t('basemap.osm'), swatch: 'linear-gradient(135deg,#f2efe9,#aad3df 60%,#c8e6a0)' },
  { id: 'satellite', label: t('basemap.satellite'), swatch: 'linear-gradient(135deg,#3c4a2c,#6b6a4b 50%,#24323d)' },
  { id: 'itineraria', label: t('basemap.itineraria'), swatch: 'linear-gradient(135deg,#f3eedc,#e8c27a 40%,#d9534f 55%,#9fc59a)' },
  ...(cartaMilitarEnabled ? [{ id: 'carta25k' as const, label: t('basemap.carta25k'), swatch: 'linear-gradient(135deg,#efe9d8,#b9ae53 45%,#6b6a3a 55%,#c9c3a0)' }] : []),
])

const currentLabel = computed(() => {
  const b = store.basemap.value
  return b.startsWith('ortos') ? `${t('basemap.ortos')} ${b.slice(5)}` : basemaps.value.find(x => x.id === b)?.label
})

/** Small corner badge and tooltip for the orthophoto years that are not plain colour. */
const yearBadge = (y: OrthoYear) => y === 2023 ? 'sat' : y === 1995 ? t('basemap.irBadge') : y === 2014 ? t('basemap.coastBadge') : null
const yearTitle = (y: OrthoYear) => y === 2023 ? t('basemap.sat') : y === 1995 ? t('basemap.ir') : y === 2014 ? t('basemap.coast') : undefined

const toggleThematic = (id: typeof store.thematic.value) => {
  store.thematic.value = store.thematic.value === id ? null : id
}

const yearBtn = (active: boolean) => [
  'relative rounded-lg border py-1.5 text-[13px] font-medium tabular-nums transition',
  active ? 'border-accent bg-accent text-accent-ink' : 'border-rule bg-card text-ink-2 hover:border-ink-3 hover:text-ink',
]
</script>

<template>
  <div class="pointer-events-auto flex flex-col items-end gap-2">
    <!-- z-10: keeps the open menu above the thematic card below -->
    <div class="relative z-10 flex rounded-xl border border-rule bg-glass shadow-panel backdrop-blur-xl">
      <MenuButton label="" align="right">
        <template #trigger="{ toggle, open }">
          <button
            type="button"
            class="flex h-[34px] items-center gap-1.5 px-3 text-[13px] font-medium text-ink-2 hover:text-ink"
            :aria-expanded="open"
            :title="t('basemap.title')"
            @click="toggle"
          >
            <Icon name="layers" :size="16" />
            <span class="hidden sm:inline">{{ currentLabel }}</span>
          </button>
        </template>
        <p class="px-3 pb-1 pt-2 text-xs font-medium text-ink-3">{{ t('basemap.title') }}</p>
        <MenuItem v-for="b in basemaps" :key="b.id" :active="store.basemap.value === b.id" @click="store.basemap.value = b.id">
          <span class="size-5 shrink-0 rounded border border-rule" :style="{ background: b.swatch }" />
          {{ b.label }}
        </MenuItem>

        <div class="px-3 pb-2 pt-2">
          <p class="text-xs font-medium text-ink-3">{{ t('basemap.ortos') }}</p>
          <p class="mb-2 text-[11px] text-ink-3/80">{{ t('basemap.ortosHint') }}</p>
          <div class="grid grid-cols-4 gap-1">
            <button
              v-for="y in ORTHO_YEARS"
              :key="y"
              type="button"
              :class="yearBtn(store.basemap.value === `ortos${y}`)"
              :aria-pressed="store.basemap.value === `ortos${y}`"
              :title="yearTitle(y)"
              @click="store.basemap.value = `ortos${y}`"
            >
              {{ y }}
              <span
                v-if="yearBadge(y)"
                class="absolute -top-1.5 right-1 rounded-full border border-rule bg-card px-1 text-[8.5px] font-semibold uppercase leading-[13px] tracking-wide text-ink-3"
              >{{ yearBadge(y) }}</span>
            </button>
          </div>
        </div>

        <div class="border-t border-rule px-3 pb-2 pt-2">
          <p class="text-xs font-medium text-ink-3">{{ t('thematic.title') }}</p>
          <p class="mb-2 text-[11px] text-ink-3/80">{{ t('thematic.hint') }}</p>
          <p class="mb-1 text-[11px] text-ink-2">{{ t('thematic.maf') }}</p>
          <div class="mb-2 grid grid-cols-4 gap-1">
            <button
              type="button" class="col-span-2" :class="yearBtn(store.thematic.value === 'maf')"
              :aria-pressed="store.thematic.value === 'maf'" @click="toggleThematic('maf')"
            >
              {{ THEMATIC_LAYERS.maf.label }}
            </button>
          </div>
          <p class="mb-1 text-[11px] text-ink-2">{{ t('thematic.cos') }}</p>
          <div class="grid grid-cols-4 gap-1">
            <button
              v-for="id in COS_IDS" :key="id" type="button" :class="yearBtn(store.thematic.value === id)"
              :aria-pressed="store.thematic.value === id" @click="toggleThematic(id)"
            >
              {{ THEMATIC_LAYERS[id].label }}
            </button>
          </div>
        </div>

        <div class="my-1 border-t border-rule" />
        <MenuItem icon="frames" :active="store.showCoverage.value" @click="store.showCoverage.value = !store.showCoverage.value">
          {{ t('coverage.layer') }}
        </MenuItem>
        <MenuItem icon="frames" :active="store.showSheets.value" @click="store.showSheets.value = !store.showSheets.value">
          {{ t('sheets.layer') }}
        </MenuItem>
        <MenuItem icon="borders" :active="store.showBoundaries.value" @click="store.showBoundaries.value = !store.showBoundaries.value">
          {{ t('map.boundaries') }}
        </MenuItem>
        <MenuItem :icon="store.showFootprints.value ? 'eye' : 'eyeOff'" @click="store.showFootprints.value = !store.showFootprints.value">
          {{ t('map.footprints') }}
        </MenuItem>
        <MenuItem icon="image" @click="emit('exportPng')">{{ t('export.png') }}</MenuItem>
      </MenuButton>

      <button
        type="button"
        class="flex h-[34px] items-center gap-1.5 border-l border-rule px-3 text-[13px] font-medium transition"
        :class="store.compare.enabled ? 'bg-accent text-accent-ink' : 'text-ink-2 hover:text-ink'"
        :aria-pressed="store.compare.enabled"
        @click="store.compare.enabled = !store.compare.enabled"
      >
        <Icon name="swipe" :size="16" />
        <span class="hidden sm:inline">{{ t('compare.toggle') }}</span>
      </button>

      <!-- "now" year for the swipe -->
      <MenuButton v-if="store.compare.enabled" label="" align="right">
        <template #trigger="{ toggle, open }">
          <button
            type="button"
            class="flex h-[34px] items-center gap-1 rounded-r-xl border-l border-accent-ink/25 bg-accent px-2.5 text-[13px] font-semibold tabular-nums text-accent-ink"
            :aria-expanded="open"
            :title="t('compare.year')"
            @click="toggle"
          >
            {{ store.compare.year }}
            <Icon name="chevronDown" :size="14" />
          </button>
        </template>
        <div class="w-64 p-2">
          <p class="mb-2 text-xs font-medium text-ink-3">{{ t('compare.year') }}</p>
          <div class="grid grid-cols-4 gap-1">
            <button
              v-for="y in ORTHO_YEARS"
              :key="y"
              type="button"
              :class="yearBtn(store.compare.year === y)"
              :aria-pressed="store.compare.year === y"
              :title="yearTitle(y)"
              @click="store.compare.year = y"
            >
              {{ y }}
              <span
                v-if="yearBadge(y)"
                class="absolute -top-1.5 right-1 rounded-full border border-rule bg-card px-1 text-[8.5px] font-semibold uppercase leading-[13px] tracking-wide text-ink-3"
              >{{ yearBadge(y) }}</span>
            </button>
          </div>
        </div>
      </MenuButton>
    </div>

    <!-- Active thematic overlay: opacity, legend, remove -->
    <div v-if="store.thematic.value" class="w-64 rounded-xl border border-rule bg-glass px-3 py-2.5 shadow-panel backdrop-blur-xl">
      <div class="flex items-center justify-between gap-2">
        <div class="min-w-0">
          <p class="truncate text-[11px] text-ink-3">{{ store.thematic.value === 'maf' ? t('thematic.maf') : t('thematic.cos') }}</p>
          <p class="text-[13px] font-medium tabular-nums">{{ THEMATIC_LAYERS[store.thematic.value].label }}</p>
        </div>
        <div class="flex shrink-0 items-center">
          <a
            :href="thematicLegendUrl(store.thematic.value)" target="_blank" rel="noopener"
            class="rounded-md px-1.5 py-0.5 text-xs text-ink-3 hover:text-accent"
          >{{ t('thematic.legend') }}</a>
          <button
            type="button" class="grid size-6 place-items-center rounded-md text-ink-3 hover:bg-paper-2 hover:text-ink"
            :aria-label="t('thematic.off')" :title="t('thematic.off')" @click="store.thematic.value = null"
          >
            <Icon name="close" :size="14" />
          </button>
        </div>
      </div>
      <input
        v-model.number="store.thematicOpacity.value" type="range" class="range mt-1.5" min="0.1" max="1" step="0.05"
        :style="{ '--pct': `${((store.thematicOpacity.value - 0.1) / 0.9) * 100}%` }" :aria-label="t('thematic.opacity')"
      >
    </div>
  </div>
</template>
