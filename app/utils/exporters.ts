import type { Photo } from './types'
import { photosAsGeoJSON } from './wfs'

export function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

export function toGeoJSON(photos: Photo[]) {
  return new Blob([JSON.stringify(photosAsGeoJSON(photos), null, 1)], { type: 'application/geo+json' })
}

const esc = (s: unknown) => String(s ?? '').replace(/[<>&'"]/g, (c: string) => `&#${c.charCodeAt(0)};`)

export function toKML(photos: Photo[]) {
  const placemarks = photos.map(p => `
  <Placemark>
    <name>${esc(`${p.rolo} / ${p.foto}`)}</name>
    <description>${esc(`${p.date ?? ''} · 1:${p.scale ?? '?'} · ${p.work}`)}</description>
    <ExtendedData>${['rolo', 'foto', 'fiada', 'date', 'scale', 'work', 'file'].map(k =>
      `<Data name="${k}"><value>${esc((p as any)[k])}</value></Data>`).join('')}</ExtendedData>
    <styleUrl>#fp</styleUrl>
    <Polygon><outerBoundaryIs><LinearRing><coordinates>${p.geometry.coordinates[0]!.map(c => `${c[0]},${c[1]},0`).join(' ')}</coordinates></LinearRing></outerBoundaryIs></Polygon>
  </Placemark>`).join('')
  const kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2"><Document>
  <name>GeoPortugal — Fototeca DGT</name>
  <Style id="fp"><LineStyle><color>ff1c34c8</color><width>1.5</width></LineStyle><PolyStyle><color>1a1c34c8</color></PolyStyle></Style>${placemarks}
</Document></kml>`
  return new Blob([kml], { type: 'application/vnd.google-earth.kml+xml' })
}

export function toCSV(photos: Photo[]) {
  const cols = ['rolo', 'foto', 'fiada', 'date', 'scale', 'work', 'support', 'format', 'resolution', 'focal', 'file', 'west', 'south', 'east', 'north'] as const
  const cell = (v: unknown) => {
    const s = String(v ?? '')
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const rows = photos.map(p => {
    const [west, south, east, north] = p.bbox
    const rec: Record<string, unknown> = { ...p, west, south, east, north }
    return cols.map(c => cell(rec[c])).join(',')
  })
  return new Blob([[cols.join(','), ...rows].join('\n')], { type: 'text/csv' })
}
