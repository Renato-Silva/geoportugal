<script setup lang="ts">
const { toasts, dismiss } = useToast()
</script>

<template>
  <div class="pointer-events-none fixed inset-x-0 top-3 z-[60] flex flex-col items-center gap-2 px-4" aria-live="polite">
    <TransitionGroup name="toast">
      <div
        v-for="tt in toasts"
        :key="tt.id"
        class="pointer-events-auto flex items-center gap-3 rounded-full py-2 pl-4 pr-2 text-sm shadow-panel"
        :class="tt.tone === 'error' ? 'bg-red-600 text-white' : 'bg-ink text-paper'"
      >
        {{ tt.text }}
        <button type="button" class="grid size-6 place-items-center rounded-full hover:bg-white/15" aria-label="Dismiss" @click="dismiss(tt.id)">
          <Icon name="close" :size="13" />
        </button>
      </div>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.toast-enter-active, .toast-leave-active { transition: all .25s; }
.toast-enter-from, .toast-leave-to { opacity: 0; transform: translateY(-8px); }
</style>
