<script setup lang="ts">
const map = ref<{ exportPng: () => void }>()
</script>

<template>
  <main class="relative h-dvh w-full overflow-hidden bg-paper">
    <MapView ref="map" />
    <div class="pointer-events-none absolute right-[58px] top-[10px] z-10">
      <MapToolbar @export-png="map?.exportPng()" />
    </div>
    <SidePanel />
    <Timelapse />
    <PhotoViewer />
    <Toasts />
  </main>
</template>
