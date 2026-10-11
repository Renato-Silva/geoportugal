import JSZip from 'jszip'
import type { Photo } from '~/utils/types'
import { photoUrl } from '~/utils/photoUrl'
import { saveBlob, toCSV, toGeoJSON, toKML } from '~/utils/exporters'
import { GEOREF_README_PT, pngSize, sidecars, worldFileForBbox } from '#shared/georef'

const MAX_ZIP = 100

export function useDownloads() {
  const { t } = useI18n()
  const toast = useToast()
  const store = useFototeca()

  async function downloadZip(photos: Photo[], name = 'geoportugal') {
    if (!photos.length) return
    if (photos.length > MAX_ZIP) {
      toast.show(t('toast.tooMany', { n: MAX_ZIP }), { tone: 'error' })
      return
    }
    const zip = new JSZip()
    const id = toast.show(t('toast.zip', { done: 0, total: photos.length }), { sticky: true })
    let done = 0
    let failed = 0
    const queue = [...photos]
    const worker = async () => {
      for (let p = queue.shift(); p; p = queue.shift()) {
        try {
          const res = await fetch(photoUrl(p, 'original'))
          if (!res.ok) throw new Error(String(res.status))
          // Every PNG ships with a world file + CRS so GIS software places it.
          const buf = await res.arrayBuffer()
          const base = `${p.rolo.replace(/[^\w]+/g, '-')}_${p.foto}`
          zip.file(`${base}.png`, buf)
          const size = pngSize(buf)
          if (size) for (const [file, text] of Object.entries(sidecars(base, worldFileForBbox(p.bbox, size.width, size.height)))) zip.file(file, text)
        }
        catch {
          failed++
        }
        done++
        toast.show(t('toast.zip', { done, total: photos.length }), { id, sticky: true })
      }
    }
    await Promise.all([worker(), worker(), worker()])
    zip.file('metadados.csv', toCSV(photos))
    zip.file('molduras.geojson', toGeoJSON(photos))
    zip.file('LEIA-ME.txt', `${GEOREF_README_PT}\n${t('credit')}\nhttps://geo5.dgterritorio.gov.pt/fototeca/\n`)
    const blob = await zip.generateAsync({ type: 'blob' })
    toast.dismiss(id)
    saveBlob(blob, `${name}.zip`)
    toast.show(failed ? `${t('toast.zipDone')} (${failed} ✕)` : t('toast.zipDone'), { tone: failed ? 'error' : 'info' })
  }

  /** One photo as a georeferenced ZIP (PNG + world file + CRS). */
  function downloadGeoref(photo: Photo) {
    return downloadZip([photo], `geoportugal_${photo.rolo.replace(/[^\w]+/g, '-')}_${photo.foto}`)
  }

  /** Server-side mosaic of several photos as one georeferenced PNG. */
  async function downloadMosaic(photos: Photo[], name = 'geoportugal_mosaico') {
    if (!photos.length) return
    if (photos.length > 60) {
      toast.show(t('toast.tooMany', { n: 60 }), { tone: 'error' })
      return
    }
    const id = toast.show(t('toast.mosaic', { n: photos.length }), { sticky: true })
    try {
      const blob = await $fetch<Blob>('/api/mosaic', {
        method: 'POST',
        body: { name, photos: photos.map(p => ({ rolo: p.rolo, foto: p.foto, bbox: p.bbox })) },
        responseType: 'blob',
        timeout: 180_000,
      })
      saveBlob(blob, `${name}.zip`)
      toast.dismiss(id)
      toast.show(t('toast.zipDone'))
    }
    catch (e) {
      console.error(e)
      toast.dismiss(id)
      toast.show(t('toast.loadFail'), { tone: 'error' })
    }
  }

  function exportFile(kind: 'geojson' | 'kml' | 'csv', photos: Photo[], name = 'geoportugal') {
    const blob = kind === 'geojson' ? toGeoJSON(photos) : kind === 'kml' ? toKML(photos) : toCSV(photos)
    saveBlob(blob, `${name}.${kind}`)
  }

  async function copyLink(photo?: Photo) {
    let url = location.origin + store.buildUrl()
    if (photo) {
      const u = new URL(url)
      u.searchParams.set('photo', photo.uid)
      const on = new Set((u.searchParams.get('on') ?? '').split(',').filter(Boolean))
      on.add(photo.uid)
      u.searchParams.set('on', [...on].join(','))
      url = u.toString().replace(/%2C/g, ',').replace(/%2F/g, '/')
    }
    try {
      await navigator.clipboard.writeText(url)
      toast.show(t('toast.linkCopied'))
    }
    catch {
      prompt('URL', url)
    }
  }

  return { downloadZip, downloadGeoref, downloadMosaic, exportFile, copyLink }
}
