<script setup lang="ts">
defineProps<{ icon?: string, active?: boolean }>()
</script>

<template>
  <button
    type="button"
    role="menuitem"
    class="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm hover:bg-paper-2"
    :class="active ? 'text-accent font-medium' : 'text-ink'"
  >
    <Icon v-if="icon" :name="icon as any" :size="16" class="shrink-0 text-ink-3" />
    <slot />
    <Icon v-if="active" name="check" :size="15" class="ml-auto" />
  </button>
</template>
