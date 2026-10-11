<script setup lang="ts">
import type { Photo } from '~/utils/types'
import { photoUrl } from '~/utils/photoUrl'

const props = defineProps<{ photo: Photo, list: Photo[], index: number, selectable?: boolean }>()
const store = useFototeca()
const { t } = useI18n()

const onMap = computed(() => store.overlayUids.value.has(props.photo.uid))
const fav = computed(() => store.favUids.value.has(props.photo.uid))
const isSelected = computed(() => store.selected.value.includes(props.photo.uid))
const hot = computed(() => store.hovered.value === props.photo.uid)
const loaded = ref(false)
</script>

<template>
  <figure
    class="develop group relative"
    :style="{ animationDelay: `${Math.min(index % 24, 16) * 28}ms` }"
    @mouseenter="store.hovered.value = photo.uid"
    @mouseleave="store.hovered.value = null"
  >
    <button
      type="button"
      class="relative block aspect-square w-full overflow-hidden rounded-lg bg-paper-2 ring-offset-2 ring-offset-card transition"
      :class="hot ? 'ring-2 ring-accent' : onMap ? 'ring-2 ring-accent/50' : ''"
      :aria-label="`${t('photo.open')} ${photo.rolo} / ${photo.foto}`"
      @click="store.openViewer(list, index)"
    >
      <img
        :src="photoUrl(photo, 'thumb', { trim: true })"
        alt=""
        loading="lazy"
        class="size-full scale-[1.12] object-cover transition duration-500 group-hover:scale-[1.18]"
        :class="loaded ? 'opacity-100' : 'opacity-0'"
        @load="loaded = true"
      >
      <span v-if="!loaded" class="absolute inset-0 animate-pulse bg-paper-2" />
    </button>

    <figcaption class="edge-print mt-1 flex items-center justify-between text-ink-3">
      <span class="truncate">{{ photo.foto }}<span v-if="photo.fiada" class="opacity-60"> /{{ photo.fiada }}</span></span>
      <Icon v-if="fav" name="star" :size="12" filled class="text-accent" />
    </figcaption>

    <!-- hover actions -->
    <div class="absolute right-1 top-1 flex gap-1 opacity-0 transition group-focus-within:opacity-100 group-hover:opacity-100" :class="{ 'opacity-100': onMap || isSelected }">
      <button
        type="button"
        class="grid size-7 place-items-center rounded-md shadow backdrop-blur transition"
        :class="onMap ? 'bg-accent text-accent-ink' : 'bg-black/55 text-white hover:bg-black/75'"
        :title="onMap ? t('photo.removeMap') : t('photo.onMap')"
        :aria-label="onMap ? t('photo.removeMap') : t('photo.onMap')"
        :aria-pressed="onMap"
        @click.stop="store.toggleOverlay(photo)"
      >
        <Icon name="map" :size="14" />
      </button>
    </div>
    <label
      v-if="selectable"
      class="absolute left-1.5 top-1.5 grid size-6 cursor-pointer place-items-center rounded-md border shadow-sm transition"
      :class="isSelected ? 'border-accent bg-accent text-accent-ink' : 'border-white/70 bg-black/40 text-transparent opacity-0 group-hover:opacity-100'"
      :title="t('results.select')"
    >
      <input type="checkbox" class="sr-only" :checked="isSelected" @change="store.toggleSelected(photo.uid)">
      <Icon name="check" :size="14" />
    </label>
  </figure>
</template>
