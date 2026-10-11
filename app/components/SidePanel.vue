<script setup lang="ts">
import type { Tab } from '~/composables/useFototeca'

const store = useFototeca()
const { t, lang, toggleLang } = useI18n()
const { isDark, toggle: toggleTheme } = useTheme()

const collapsed = ref(false)

const tabs = computed<{ id: Tab, label: string, badge?: number }[]>(() => [
  { id: 'search', label: t('tab.search') },
  { id: 'map', label: t('tab.map'), badge: store.overlays.value.length || undefined },
  { id: 'saved', label: t('tab.saved'), badge: store.favs.value.length || undefined },
])

const scroller = ref<HTMLElement>()
watch(store.tab, () => scroller.value?.scrollTo({ top: 0 }))
watch(store.area, (a) => { if (a) collapsed.value = false })
</script>

<template>
  <aside
    class="grain pointer-events-auto absolute z-20 flex flex-col overflow-hidden border-rule shadow-panel transition-[height,transform] duration-300
           inset-x-0 bottom-0 rounded-t-2xl border-t
           md:top-3 md:bottom-auto md:left-3 md:right-auto md:w-[420px] md:rounded-2xl md:border"
    :class="collapsed ? 'h-[132px] md:h-[calc(100dvh-24px)]' : 'h-[58vh] md:h-[calc(100dvh-24px)]'"
  >
    <!-- mobile grabber -->
    <button type="button" class="mx-auto mt-2 h-1.5 w-12 shrink-0 rounded-full bg-rule md:hidden" :aria-label="collapsed ? 'Expand' : 'Collapse'" @click="collapsed = !collapsed" />

    <!-- masthead -->
    <header class="flex items-start justify-between gap-3 px-5 pb-3 pt-3 md:pt-5">
      <div class="min-w-0">
        <h1 class="flex items-center gap-2 text-[19px] font-semibold tracking-tight">
          <img src="/favicon.svg" alt="" class="size-7">
          GeoPortugal
        </h1>
        <p class="mt-1 text-[12.5px] text-ink-3">{{ t('tagline') }}</p>
      </div>
      <div class="flex shrink-0 items-center gap-1">
        <button
          type="button"
          class="grid h-8 place-items-center rounded-lg px-2 text-xs font-semibold text-ink-2 hover:bg-paper-2 hover:text-ink"
          :title="t('lang.toggle')"
          @click="toggleLang"
        >
          {{ lang === 'pt' ? 'EN' : 'PT' }}
        </button>
        <button type="button" class="grid size-8 place-items-center rounded-lg text-ink-2 hover:bg-paper-2 hover:text-ink" :aria-label="t('theme.toggle')" :title="t('theme.toggle')" @click="toggleTheme">
          <Icon :name="isDark ? 'sun' : 'moon'" :size="17" />
        </button>
      </div>
    </header>

    <!-- tabs -->
    <nav class="mx-5 flex gap-1 rounded-xl bg-paper-2 p-1" role="tablist">
      <button
        v-for="tb in tabs"
        :key="tb.id"
        type="button"
        role="tab"
        :aria-selected="store.tab.value === tb.id"
        class="flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-[13px] font-medium transition"
        :class="store.tab.value === tb.id ? 'bg-card text-ink shadow-sm' : 'text-ink-3 hover:text-ink-2'"
        @click="store.tab.value = tb.id; collapsed = false"
      >
        {{ tb.label }}
        <span v-if="tb.badge" class="rounded-full bg-accent px-1.5 text-[10px] font-semibold leading-4 text-accent-ink">{{ tb.badge }}</span>
      </button>
    </nav>

    <div ref="scroller" class="scroll-thin min-h-0 flex-1 overflow-y-auto px-5 pb-8 pt-4">
      <!-- SEARCH -->
      <div v-show="store.tab.value === 'search'" class="space-y-4">
        <PlaceSearch />
        <AreaTools />

        <!-- current area -->
        <div v-if="store.area.value" class="rise flex items-center gap-2 rounded-xl bg-accent-soft px-3 py-2.5 text-ink ring-1 ring-accent/25">
          <Icon :name="store.area.value.kind === 'point' ? 'pin' : store.area.value.kind === 'box' ? 'box' : store.area.value.kind === 'view' ? 'view' : 'search'" :size="16" class="shrink-0 text-accent" />
          <button type="button" class="min-w-0 flex-1 truncate text-left text-sm font-medium hover:underline" @click="store.fitBbox(store.area.value!.bbox)">
            {{ store.area.value.label }}
          </button>
          <button type="button" class="grid size-6 shrink-0 place-items-center rounded-md text-ink-2 hover:bg-card hover:text-ink" :aria-label="t('area.clear')" :title="t('area.clear')" @click="store.clearArea()">
            <Icon name="close" :size="15" />
          </button>
        </div>

        <template v-if="store.area.value">
          <Timeline />
          <ScaleFilter />
          <ResultsList v-if="store.summary.value.length || store.photos.value.length" />
        </template>
      </div>

      <OverlaysPanel v-if="store.tab.value === 'map'" />
      <SavedPanel v-if="store.tab.value === 'saved'" />
    </div>

    <footer class="hidden border-t border-rule px-5 py-2 text-[10.5px] text-ink-3 md:block">
      {{ t('credit') }} · <a href="https://geo5.dgterritorio.gov.pt/fototeca/" target="_blank" rel="noopener" class="underline hover:text-ink">Webfototeca</a>
    </footer>
  </aside>
</template>
