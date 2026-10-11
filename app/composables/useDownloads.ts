import JSZip from 'jszip'
import type { Photo } from '~/utils/types'
import { photoUrl } from '~/utils/photoUrl'
import { saveBlob, toCSV, toGeoJSON, toKML } from '~/utils/exporters'

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
          zip.file(`${p.rolo.replace(/[^\w]+/g, '-')}_${p.foto}.png`, await res.blob())
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
    zip.file('LEIA-ME.txt', `${t('credit')}\nhttps://geo5.dgterritorio.gov.pt/fototeca/\n`)
    const blob = await zip.generateAsync({ type: 'blob' })
    toast.dismiss(id)
    saveBlob(blob, `${name}.zip`)
    toast.show(failed ? `${t('toast.zipDone')} (${failed} ✕)` : t('toast.zipDone'), { tone: failed ? 'error' : 'info' })
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

  return { downloadZip, exportFile, copyLink }
}
