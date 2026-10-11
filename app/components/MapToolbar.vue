<script setup lang="ts">
import { ORTHO_YEARS, type BasemapId } from '~/composables/useFototeca'

const emit = defineEmits<{ exportPng: [] }>()
const store = useFototeca()
const { t } = useI18n()

const basemaps = computed<{ id: BasemapId, label: string, swatch: string }[]>(() => [
  { id: 'map', label: t('basemap.map'), swatch: 'linear-gradient(135deg,#f4f5f7,#d9dde3)' },
  { id: 'osm', label: t('basemap.osm'), swatch: 'linear-gradient(135deg,#f2efe9,#aad3df 60%,#c8e6a0)' },
  { id: 'satellite', label: t('basemap.satellite'), swatch: 'linear-gradient(135deg,#3c4a2c,#6b6a4b 50%,#24323d)' },
])

const currentLabel = computed(() => {
  const b = store.basemap.value
  return b.startsWith('ortos') ? `${t('basemap.ortos')} ${b.slice(5)}` : basemaps.value.find(x => x.id === b)?.label
})

const yearBtn = (active: boolean) => [
  'rounded-lg border py-1.5 text-[13px] font-medium tabular-nums transition',
  active ? 'border-accent bg-accent text-accent-ink' : 'border-rule bg-card text-ink-2 hover:border-ink-3 hover:text-ink',
]
</script>

<template>
  <div class="pointer-events-auto flex flex-col items-end gap-2">
    <div class="flex rounded-xl border border-rule bg-glass shadow-panel backdrop-blur-xl">
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
          <div class="grid grid-cols-3 gap-1">
            <button
              v-for="y in ORTHO_YEARS"
              :key="y"
              type="button"
              :class="yearBtn(store.basemap.value === `ortos${y}`)"
              :aria-pressed="store.basemap.value === `ortos${y}`"
              @click="store.basemap.value = `ortos${y}`"
            >
              {{ y }}
            </button>
          </div>
        </div>

        <div class="my-1 border-t border-rule" />
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
        <div class="w-56 p-2">
          <p class="mb-2 text-xs font-medium text-ink-3">{{ t('compare.year') }}</p>
          <div class="grid grid-cols-3 gap-1">
            <button
              v-for="y in ORTHO_YEARS"
              :key="y"
              type="button"
              :class="yearBtn(store.compare.year === y)"
              :aria-pressed="store.compare.year === y"
              @click="store.compare.year = y"
            >
              {{ y }}
            </button>
          </div>
        </div>
      </MenuButton>
    </div>
  </div>
</template>
