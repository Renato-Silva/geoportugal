<script setup lang="ts">
import type { BasemapId } from '~/composables/useFototeca'

const emit = defineEmits<{ exportPng: [] }>()
const store = useFototeca()
const { t } = useI18n()

const basemaps = computed<{ id: BasemapId, label: string, swatch: string }[]>(() => [
  { id: 'map', label: t('basemap.map'), swatch: 'linear-gradient(135deg,#f4f5f7,#d9dde3)' },
  { id: 'osm', label: t('basemap.osm'), swatch: 'linear-gradient(135deg,#f2efe9,#aad3df 60%,#c8e6a0)' },
  { id: 'satellite', label: t('basemap.satellite'), swatch: 'linear-gradient(135deg,#3c4a2c,#6b6a4b 50%,#24323d)' },
  { id: 'ortos2021', label: t('basemap.ortos2021'), swatch: 'linear-gradient(135deg,#7d7a55,#a59c74 50%,#56603d)' },
  { id: 'ortos2018', label: t('basemap.ortos2018'), swatch: 'linear-gradient(135deg,#6f6d4b,#9a9270 50%,#4e5838)' },
])
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
            <span class="hidden sm:inline">{{ basemaps.find(b => b.id === store.basemap.value)?.label }}</span>
          </button>
        </template>
        <p class="px-3 pb-1 pt-2 text-xs font-medium text-ink-3">{{ t('basemap.title') }}</p>
        <MenuItem v-for="b in basemaps" :key="b.id" :active="store.basemap.value === b.id" @click="store.basemap.value = b.id">
          <span class="size-5 shrink-0 rounded border border-rule" :style="{ background: b.swatch }" />
          {{ b.label }}
        </MenuItem>
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
    </div>
  </div>
</template>
