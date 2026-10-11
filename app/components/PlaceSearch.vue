<script setup lang="ts">
import type { AdminUnit, Bbox, GeoPlace, PlaceResults } from '~/utils/types'

const store = useFototeca()
const { t } = useI18n()

type Item =
  | { kind: 'admin', id: string, unit: AdminUnit }
  | { kind: 'place', id: string, place: GeoPlace }

const q = ref('')
const results = ref<PlaceResults>({ admin: [], places: [] })
const open = ref(false)
const active = ref(-1)
const loading = ref(false)
const input = ref<HTMLInputElement>()
let timer: ReturnType<typeof setTimeout> | undefined
let seq = 0

const items = computed<Item[]>(() => [
  ...results.value.admin.map(unit => ({ kind: 'admin' as const, id: `a:${unit.level}:${unit.code}`, unit })),
  ...results.value.places.map(place => ({ kind: 'place' as const, id: `p:${place.id}`, place })),
])

watch(q, (val) => {
  clearTimeout(timer)
  const term = val.trim()
  if (term.length < 2) {
    results.value = { admin: [], places: [] }
    loading.value = false
    return
  }
  loading.value = true
  timer = setTimeout(async () => {
    const mine = ++seq
    try {
      const data = await $fetch<PlaceResults>('/api/places', { query: { q: term } })
      if (mine !== seq) return
      results.value = data
      active.value = items.value.length ? 0 : -1
      open.value = true
    }
    catch {
      if (mine === seq) results.value = { admin: [], places: [] }
    }
    finally {
      if (mine === seq) loading.value = false
    }
  }, 280)
})

const LEVEL_KEYS = { district: 'level.district', municipality: 'level.municipality', parish: 'level.parish' } as const
const levelLabel = (u: AdminUnit) =>
  u.level === 'district' && /^Ilha/i.test(u.name) ? t('level.island') : t(LEVEL_KEYS[u.level])

function adminContext(u: AdminUnit) {
  if (u.level === 'parish') return `${levelLabel(u)} · ${u.municipality}`
  if (u.level === 'municipality') return `${levelLabel(u)} · ${u.district}`
  return levelLabel(u)
}

const PLACE_TYPES: Record<string, 'type.populatedPlace' | 'type.landform' | 'type.hydrography'> = {
  populatedPlace: 'type.populatedPlace',
  landform: 'type.landform',
  hydrography: 'type.hydrography',
}

function placeContext(p: GeoPlace) {
  const type = PLACE_TYPES[p.type] ? t(PLACE_TYPES[p.type]!) : ''
  return [type, p.municipality].filter(Boolean).join(' · ')
}

/** Search radius around a gazetteer point: villages are small, landforms are not. */
function boxAround([lng, lat]: [number, number], type: string): Bbox {
  const r = type === 'populatedPlace' ? 0.012 : 0.03
  return [lng - r, lat - r * 0.8, lng + r, lat + r * 0.8]
}

function choose(item: Item) {
  q.value = ''
  results.value = { admin: [], places: [] }
  open.value = false
  input.value?.blur()
  if (item.kind === 'admin') {
    const u = item.unit
    store.setArea({
      kind: 'admin',
      label: `${u.name} · ${levelLabel(u)}`,
      bbox: [0, 0, 0, 0], // replaced by the boundary's own bbox
      admin: { level: u.level, code: u.code },
    })
  }
  else {
    const p = item.place
    store.setArea({
      kind: 'place',
      label: p.municipality && p.municipality !== p.name ? `${p.name}, ${p.municipality}` : p.name,
      bbox: boxAround(p.point, p.type),
      point: p.point,
    })
  }
}

function onKey(e: KeyboardEvent) {
  const n = items.value.length
  if (!open.value || !n) return
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    active.value = (active.value + 1) % n
  }
  else if (e.key === 'ArrowUp') {
    e.preventDefault()
    active.value = (active.value - 1 + n) % n
  }
  else if (e.key === 'Enter' && items.value[active.value]) {
    e.preventDefault()
    choose(items.value[active.value]!)
  }
  else if (e.key === 'Escape') {
    open.value = false
  }
}

function onBlur() {
  setTimeout(() => (open.value = false), 150)
}

const indexOf = (id: string) => items.value.findIndex(i => i.id === id)
</script>

<template>
  <div class="relative">
    <label class="group flex items-center gap-2 rounded-xl border border-rule bg-card px-3 py-2.5 shadow-sm transition focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/15">
      <Icon name="search" class="shrink-0 text-ink-3" />
      <input
        ref="input"
        v-model="q"
        type="search"
        role="combobox"
        aria-autocomplete="list"
        :aria-expanded="open && !!items.length"
        aria-controls="place-results"
        :placeholder="t('search.placeholder')"
        class="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-ink-3"
        @keydown="onKey"
        @focus="open = true"
        @blur="onBlur"
      >
      <span v-if="loading" class="size-4 shrink-0 animate-spin rounded-full border-2 border-rule border-t-accent" />
    </label>

    <div
      v-if="open && q.trim().length >= 2 && !loading"
      id="place-results"
      role="listbox"
      class="scroll-thin rise absolute inset-x-0 top-full z-40 mt-1.5 max-h-[420px] overflow-y-auto rounded-xl border border-rule bg-card p-1 shadow-panel"
    >
      <p v-if="!items.length" class="px-3 py-2 text-sm text-ink-3">{{ t('search.noResults') }}</p>

      <template v-if="results.admin.length">
        <p class="px-3 pb-1 pt-2 text-[11px] font-medium text-ink-3">{{ t('search.admin') }}</p>
        <div
          v-for="u in results.admin"
          :key="`a:${u.level}:${u.code}`"
          role="option"
          :aria-selected="indexOf(`a:${u.level}:${u.code}`) === active"
          class="flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2"
          :class="indexOf(`a:${u.level}:${u.code}`) === active ? 'bg-paper-2' : ''"
          @mouseenter="active = indexOf(`a:${u.level}:${u.code}`)"
          @mousedown.prevent="choose({ kind: 'admin', id: `a:${u.level}:${u.code}`, unit: u })"
        >
          <Icon name="shape" :size="16" class="shrink-0 text-accent" />
          <span class="min-w-0 flex-1">
            <span class="block truncate text-sm font-medium">{{ u.name }}</span>
            <span class="block truncate text-xs text-ink-3">{{ adminContext(u) }}</span>
          </span>
        </div>
      </template>

      <template v-if="results.places.length">
        <p class="px-3 pb-1 pt-2 text-[11px] font-medium text-ink-3">{{ t('search.places') }}</p>
        <div
          v-for="p in results.places"
          :key="`p:${p.id}`"
          role="option"
          :aria-selected="indexOf(`p:${p.id}`) === active"
          class="flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2"
          :class="indexOf(`p:${p.id}`) === active ? 'bg-paper-2' : ''"
          @mouseenter="active = indexOf(`p:${p.id}`)"
          @mousedown.prevent="choose({ kind: 'place', id: `p:${p.id}`, place: p })"
        >
          <Icon name="pin" :size="16" class="shrink-0 text-ink-3" />
          <span class="min-w-0 flex-1">
            <span class="block truncate text-sm font-medium">{{ p.name }}</span>
            <span class="block truncate text-xs text-ink-3">{{ placeContext(p) }}</span>
          </span>
        </div>
      </template>
    </div>
  </div>
</template>
