<script setup lang="ts">
defineProps<{ label: string, align?: 'left' | 'right', up?: boolean }>()
const open = ref(false)
const root = ref<HTMLElement>()
function onDoc(e: PointerEvent) {
  if (!root.value?.contains(e.target as Node)) open.value = false
}
watch(open, (o) => {
  if (o) document.addEventListener('pointerdown', onDoc)
  else document.removeEventListener('pointerdown', onDoc)
})
onBeforeUnmount(() => document.removeEventListener('pointerdown', onDoc))
</script>

<template>
  <div ref="root" class="relative" @keydown.esc="open = false">
    <slot name="trigger" :open="open" :toggle="() => (open = !open)">
      <button
        type="button"
        class="flex items-center gap-1 rounded-lg border border-rule px-2.5 py-1.5 text-xs text-ink-2 hover:border-ink-3 hover:text-ink"
        :aria-expanded="open"
        @click="open = !open"
      >
        {{ label }} <Icon name="chevronDown" :size="14" />
      </button>
    </slot>
    <div
      v-if="open"
      class="rise scroll-thin absolute z-40 max-h-[calc(100dvh-6rem)] min-w-52 overflow-y-auto rounded-xl border border-rule bg-card p-1 shadow-panel"
      :class="[align === 'left' ? 'left-0' : 'right-0', up ? 'bottom-full mb-1.5' : 'top-full mt-1.5']"
      role="menu"
      @click="open = false"
    >
      <slot />
    </div>
  </div>
</template>
