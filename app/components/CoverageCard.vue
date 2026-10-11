<script setup lang="ts">
import type { Bbox } from '~/utils/types'
import { DECADES } from '~/composables/useCoverage'
import { formatCount } from '~/utils/format'

const store = useFototeca()
const coverage = useCoverage()
const { t, lang } = useI18n()

const stats = shallowRef({ total: 0, perDecade: DECADES.map(() => 0) })

function refresh() {
  const m = store.map.value
  if (!m || !coverage.data.value) return
  const b = m.getBounds()
  stats.value = coverage.statsIn([b.getWest(), b.getSouth(), b.getEast(), b.getNorth()] as Bbox)
}

onMounted(() => coverage.load().then(refresh))
watch([store.view, store.map, coverage.data], refresh)

const max = computed(() => Math.max(1, ...stats.value.perDecade))
const shownTotal = computed(() => coverage.decades.value.length
  ? coverage.decades.value.reduce((n, i) => n + stats.value.perDecade[i]!, 0)
  : stats.value.total)
const active = (i: number) => !coverage.decades.value.length || coverage.decades.value.includes(i)
</script>

<template>
  <section class="rise rounded-2xl border border-rule bg-card p-4">
    <div class="flex items-baseline justify-between gap-3">
      <div>
        <p class="text-xs font-medium text-ink-3">{{ t('coverage.title') }}</p>
        <p class="mt-1 text-[26px] font-semibold leading-none tracking-tight tabular-nums">
          {{ coverage.data.value ? formatCount(shownTotal, lang) : '…' }}
        </p>
      </div>
      <button
        v-if="coverage.decades.value.length"
        type="button"
        class="rounded-full border border-rule px-2.5 py-1 text-xs text-ink-2 hover:border-ink-3 hover:text-ink"
        @click="coverage.decades.value = []"
      >
        {{ t('timeline.reset') }}
      </button>
    </div>

    <!-- photos per decade in view; click to filter the coverage map -->
    <div class="mt-4 grid grid-cols-7 items-end gap-1.5" role="group" :aria-label="t('coverage.byDecade')">
      <button
        v-for="(d, i) in DECADES"
        :key="d"
        type="button"
        class="group flex flex-col items-center gap-1.5"
        :aria-pressed="coverage.decades.value.includes(i)"
        :title="`${d}s · ${formatCount(stats.perDecade[i]!, lang)}`"
        @click="coverage.toggleDecade(i)"
      >
        <span class="text-[10.5px] tabular-nums text-ink-3">{{ stats.perDecade[i] ? formatCount(stats.perDecade[i]!, lang) : '' }}</span>
        <span class="flex h-16 w-full items-end">
          <span
            class="w-full rounded-t-[4px] transition-all"
            :class="active(i) ? 'bg-accent' : 'bg-rule'"
            :style="{ height: `${stats.perDecade[i] ? Math.max(6, (stats.perDecade[i]! / max) * 100) : 0}%` }"
          />
        </span>
        <span class="text-[11px] font-medium tabular-nums" :class="coverage.decades.value.includes(i) ? 'text-accent' : 'text-ink-2'">{{ String(d).slice(2) }}s</span>
      </button>
    </div>

    <div class="mt-4 flex items-center gap-2 text-[11px] text-ink-3">
      <span>{{ t('coverage.fewer') }}</span>
      <span class="h-2 flex-1 rounded-full" style="background: linear-gradient(to right, #d3e2ff, #9cc0ff, #5b98ff, #1f6fff, #0a3a9e)" />
      <span>{{ t('coverage.more') }}</span>
    </div>
    <p class="mt-3 text-xs leading-relaxed text-ink-3">{{ t('coverage.hint') }}</p>
  </section>
</template>
