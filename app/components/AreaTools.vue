<script setup lang="ts">
import type { Bbox } from '~/utils/types'
import { PORTUGAL_BBOX } from '~/utils/geo'

const store = useFototeca()
const { t } = useI18n()

function searchView() {
  const m = store.map.value
  if (!m) return
  const b = m.getBounds()
  const raw: Bbox = [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()]
  const bbox: Bbox = [
    Math.max(raw[0], PORTUGAL_BBOX[0]), Math.max(raw[1], PORTUGAL_BBOX[1]),
    Math.min(raw[2], PORTUGAL_BBOX[2]), Math.min(raw[3], PORTUGAL_BBOX[3]),
  ]
  if (bbox[0] >= bbox[2] || bbox[1] >= bbox[3]) return
  store.setArea({ kind: 'view', label: t('area.viewLabel'), bbox }, { fit: false })
}

const toggle = (m: 'box' | 'point') => { store.mode.value = store.mode.value === m ? 'pan' : m }

const tools = computed(() => [
  { id: 'view', icon: 'view' as const, label: t('area.view'), active: false, run: searchView },
  { id: 'box', icon: 'box' as const, label: t('area.box'), active: store.mode.value === 'box', run: () => toggle('box') },
  { id: 'point', icon: 'pin' as const, label: t('area.point'), active: store.mode.value === 'point', run: () => toggle('point') },
])
</script>

<template>
  <div class="grid grid-cols-3 gap-1.5">
    <button
      v-for="tool in tools"
      :key="tool.id"
      type="button"
      class="flex items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-[13px] font-medium transition"
      :class="tool.active ? 'border-accent bg-accent text-accent-ink' : 'border-rule bg-card text-ink-2 hover:border-ink-3 hover:text-ink'"
      :aria-pressed="tool.active"
      @click="tool.run"
    >
      <Icon :name="tool.icon" :size="16" />
      <span class="truncate">{{ tool.label }}</span>
    </button>
  </div>
</template>
