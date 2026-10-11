import { readStore, writeStore } from '~/utils/storage'

type Pref = 'system' | 'light' | 'dark'

const pref = ref<Pref>(readStore<Pref>('geoportugal:theme', 'light'))
const media = window.matchMedia('(prefers-color-scheme: dark)')
const systemDark = ref(media.matches)
media.addEventListener('change', e => { systemDark.value = e.matches })

const isDark = computed(() => pref.value === 'dark' || (pref.value === 'system' && systemDark.value))

watch(isDark, d => document.documentElement.classList.toggle('dark', d), { immediate: true })
watch(pref, p => writeStore('geoportugal:theme', p))

export function useTheme() {
  // Light by default; the user can opt into dark.
  const toggle = () => { pref.value = isDark.value ? 'light' : 'dark' }
  return { isDark, pref, toggle }
}
