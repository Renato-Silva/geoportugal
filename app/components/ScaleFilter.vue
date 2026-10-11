<script setup lang="ts">
import { formatCount, formatScale } from '~/utils/format'

const store = useFototeca()
const { t, lang } = useI18n()
</script>

<template>
  <section v-if="store.scaleCounts.value.length">
    <h3 class="mb-2 text-xs font-medium text-ink-3">{{ t('scales.title') }}</h3>
    <div class="flex flex-wrap gap-1.5">
      <button
        type="button"
        class="rounded-full border px-2.5 py-1 text-xs transition"
        :class="!store.scales.value.length ? 'border-accent bg-accent text-accent-ink' : 'border-rule bg-card text-ink-2 hover:border-ink-3'"
        :aria-pressed="!store.scales.value.length"
        @click="store.scales.value = []"
      >
        {{ t('scales.all') }}
      </button>
      <button
        v-for="[scale, count] in store.scaleCounts.value"
        :key="scale"
        type="button"
        class="flex items-baseline gap-1.5 rounded-full border px-2.5 py-1 text-xs transition"
        :class="store.scales.value.includes(scale) ? 'border-accent bg-accent text-accent-ink' : 'border-rule bg-card text-ink-2 hover:border-ink-3'"
        :aria-pressed="store.scales.value.includes(scale)"
        @click="store.toggleScale(scale)"
      >
        <span class="font-medium tabular-nums">{{ formatScale(scale, lang) }}</span>
        <span class="opacity-60">{{ formatCount(count, lang) }}</span>
      </button>
    </div>
  </section>
</template>
