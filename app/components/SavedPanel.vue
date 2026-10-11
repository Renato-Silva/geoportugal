<script setup lang="ts">
const store = useFototeca()
const { t } = useI18n()
const dl = useDownloads()
</script>

<template>
  <div class="space-y-7">
    <section>
      <div class="mb-3 flex items-center justify-between">
        <h2 class="text-[17px] font-semibold tracking-tight">{{ t('saved.favs') }}</h2>
        <MenuButton v-if="store.favs.value.length" :label="t('results.export')">
          <MenuItem icon="map" @click="store.addOverlays(store.favs.value)">{{ t('results.addMap') }}</MenuItem>
          <MenuItem icon="download" @click="dl.downloadZip(store.favs.value, 'geoportugal_guardadas')">{{ t('results.zip') }}</MenuItem>
          <MenuItem icon="file" @click="dl.exportFile('geojson', store.favs.value, 'geoportugal_guardadas')">{{ t('export.geojson') }}</MenuItem>
          <MenuItem icon="globe" @click="dl.exportFile('kml', store.favs.value, 'geoportugal_guardadas')">{{ t('export.kml') }}</MenuItem>
          <MenuItem icon="file" @click="dl.exportFile('csv', store.favs.value, 'geoportugal_guardadas')">{{ t('export.csv') }}</MenuItem>
        </MenuButton>
      </div>
      <p v-if="!store.favs.value.length" class="rounded-xl border border-dashed border-rule p-5 text-sm text-ink-3">{{ t('saved.favsEmpty') }}</p>
      <div v-else class="grid grid-cols-4 gap-2">
        <PhotoCard v-for="(p, i) in store.favs.value" :key="p.uid" :photo="p" :list="store.favs.value" :index="i" />
      </div>
    </section>

    <section v-if="store.recentAreas.value.length">
      <div class="mb-2 flex items-center justify-between">
        <h3 class="text-xs font-medium text-ink-3">{{ t('saved.recentAreas') }}</h3>
        <button type="button" class="text-xs text-ink-3 hover:text-accent" @click="store.recentAreas.value = []">{{ t('saved.clear') }}</button>
      </div>
      <ul class="space-y-0.5">
        <li v-for="a in store.recentAreas.value" :key="a.label + a.bbox.join()">
          <button type="button" class="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left text-sm hover:bg-paper-2" @click="store.setArea(a, { fit: true })">
            <Icon :name="a.kind === 'point' ? 'pin' : a.kind === 'box' ? 'box' : 'history'" :size="16" class="shrink-0 text-ink-3" />
            <span class="truncate">{{ a.label }}</span>
          </button>
        </li>
      </ul>
    </section>

    <section v-if="store.recentPhotos.value.length">
      <div class="mb-2 flex items-center justify-between">
        <h3 class="text-xs font-medium text-ink-3">{{ t('saved.recentPhotos') }}</h3>
        <button type="button" class="text-xs text-ink-3 hover:text-accent" @click="store.recentPhotos.value = []">{{ t('saved.clear') }}</button>
      </div>
      <ul>
        <li v-for="p in store.recentPhotos.value.slice(0, 12)" :key="p.uid">
          <PhotoRow :photo="p" :list="store.recentPhotos.value" />
        </li>
      </ul>
    </section>
  </div>
</template>
