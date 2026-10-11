<script setup lang="ts">
import type { Photo } from '~/utils/types'
import { photoUrl } from '~/utils/photoUrl'
import { formatDate, formatScale } from '~/utils/format'
import { yearColor } from '~/utils/colors'

const props = defineProps<{ photo: Photo, list: Photo[] }>()
const store = useFototeca()
const { t, lang } = useI18n()
const { isDark } = useTheme()
const onMap = computed(() => store.overlayUids.value.has(props.photo.uid))
</script>

<template>
  <div
    class="group flex items-center gap-3 rounded-lg p-1.5 hover:bg-paper-2"
    @mouseenter="store.hovered.value = photo.uid"
    @mouseleave="store.hovered.value = null"
  >
    <button
      type="button"
      class="relative size-14 shrink-0 overflow-hidden rounded-lg bg-paper-2"
      :aria-label="t('photo.open')"
      @click="store.openViewer(list, list.indexOf(photo))"
    >
      <img :src="photoUrl(photo, 'thumb')" alt="" loading="lazy" class="size-full object-cover opacity-90 transition group-hover:opacity-100">
    </button>
    <div class="min-w-0 flex-1">
      <div class="flex items-center gap-1.5">
        <span class="size-2 shrink-0 rounded-full" :style="{ background: yearColor(photo.year, isDark) }" />
        <span class="truncate text-sm font-medium">{{ formatDate(photo.date, lang, 'short') }}</span>
      </div>
      <div class="edge-print mt-0.5 truncate text-ink-3">
        {{ photo.rolo }} · {{ photo.foto }} · {{ formatScale(photo.scale, lang) }}
      </div>
    </div>
    <button
      type="button"
      class="grid size-8 shrink-0 place-items-center rounded-md transition"
      :class="onMap ? 'bg-accent text-accent-ink' : 'text-ink-3 hover:bg-card hover:text-ink'"
      :aria-label="onMap ? t('photo.removeMap') : t('photo.onMap')"
      :title="onMap ? t('photo.removeMap') : t('photo.onMap')"
      @click="store.toggleOverlay(photo)"
    >
      <Icon name="map" :size="16" />
    </button>
  </div>
</template>
