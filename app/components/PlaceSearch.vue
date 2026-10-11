<script setup lang="ts">
import type { Place } from '~/utils/types'

const store = useFototeca()
const { t } = useI18n()

const q = ref('')
const results = ref<Place[]>([])
const open = ref(false)
const active = ref(-1)
const loading = ref(false)
const input = ref<HTMLInputElement>()
let timer: ReturnType<typeof setTimeout> | undefined
let seq = 0

/** Districts and municipalities first — they are what most people mean. */
const kindRank = (p: Place) => /Distrito/i.test(p.context) ? 0 : /^Concelho,/i.test(p.context) ? 1 : 2

watch(q, (val) => {
  clearTimeout(timer)
  const term = val.trim()
  if (term.length < 2) {
    results.value = []
    loading.value = false
    return
  }
  loading.value = true
  timer = setTimeout(async () => {
    const mine = ++seq
    try {
      const data = await $fetch<Place[]>('/api/places', { query: { q: term } })
      if (mine !== seq) return
      results.value = [...data].sort((a, b) => kindRank(a) - kindRank(b)).slice(0, 30)
      active.value = data.length ? 0 : -1
      open.value = true
    }
    catch {
      if (mine === seq) results.value = []
    }
    finally {
      if (mine === seq) loading.value = false
    }
  }, 280)
})

function choose(p: Place) {
  q.value = ''
  results.value = []
  open.value = false
  input.value?.blur()
  store.setArea({ kind: 'place', label: p.context ? `${p.name}, ${p.context}` : p.name, bbox: p.bbox })
}

function onKey(e: KeyboardEvent) {
  if (!open.value || !results.value.length) return
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    active.value = (active.value + 1) % results.value.length
  }
  else if (e.key === 'ArrowUp') {
    e.preventDefault()
    active.value = (active.value - 1 + results.value.length) % results.value.length
  }
  else if (e.key === 'Enter' && results.value[active.value]) {
    e.preventDefault()
    choose(results.value[active.value]!)
  }
  else if (e.key === 'Escape') {
    open.value = false
  }
}

// Title-case the archive's SHOUTED names for display.
function pretty(s: string) {
  return s === s.toUpperCase() ? s.toLowerCase().replace(/(^|[\s\-'(])(\p{L})/gu, (_, a, b) => a + b.toUpperCase()) : s
}

function onBlur() {
  setTimeout(() => (open.value = false), 150)
}
</script>

<template>
  <div class="relative">
    <label class="group flex items-center gap-2 rounded-xl border border-rule bg-card px-3 py-2.5 shadow-sm transition focus-within:border-ink-3">
      <Icon name="search" class="shrink-0 text-ink-3" />
      <input
        ref="input"
        v-model="q"
        type="search"
        role="combobox"
        aria-autocomplete="list"
        :aria-expanded="open && !!results.length"
        aria-controls="place-results"
        :placeholder="t('search.placeholder')"
        class="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-ink-3"
        @keydown="onKey"
        @focus="open = true"
        @blur="onBlur"
      >
      <span v-if="loading" class="size-4 shrink-0 animate-spin rounded-full border-2 border-rule border-t-accent" />
    </label>

    <ul
      v-if="open && q.trim().length >= 2 && !loading"
      id="place-results"
      role="listbox"
      class="scroll-thin rise absolute inset-x-0 top-full z-40 mt-1.5 max-h-80 overflow-y-auto rounded-xl border border-rule bg-card p-1 shadow-panel"
    >
      <li v-if="!results.length" class="px-3 py-2 text-sm text-ink-3">{{ t('search.noResults') }}</li>
      <li
        v-for="(p, i) in results"
        :key="p.id"
        role="option"
        :aria-selected="i === active"
        class="flex cursor-pointer items-baseline justify-between gap-3 rounded-lg px-3 py-2"
        :class="i === active ? 'bg-paper-2' : ''"
        @mouseenter="active = i"
        @mousedown.prevent="choose(p)"
      >
        <span class="truncate font-medium">{{ pretty(p.name) }}</span>
        <span class="truncate text-right text-xs text-ink-3">{{ pretty(p.context) }}</span>
      </li>
    </ul>
  </div>
</template>
