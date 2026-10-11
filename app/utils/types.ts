export type Bbox = [number, number, number, number]

export interface Photo {
  /** `${rolo}_${foto}` — unique id of a frame in the archive */
  uid: string
  rolo: string
  foto: string
  fiada: string
  /** YYYY-MM-DD, or YYYY-MM / YYYY when partially known, null if unknown */
  date: string | null
  year: number | null
  scale: number | null
  work: string
  support: string
  /** film format, mm */
  format: number | null
  resolution: number | null
  /** focal length, mm */
  focal: number | null
  file: string
  bbox: Bbox
  geometry: GeoJSON.Polygon
}

export type AreaKind = 'place' | 'view' | 'box' | 'point'

export interface Area {
  kind: AreaKind
  label: string
  bbox: Bbox
  /** for point searches: the clicked location */
  point?: [number, number]
}

export interface Place {
  id: string
  name: string
  context: string
  bbox: Bbox
}

export interface YearScaleCount {
  year: number
  scale: number
  count: number
}

export interface Overlay {
  photo: Photo
  opacity: number
  visible: boolean
}

export interface PhotoFilter {
  bbox: Bbox
  years: [number, number]
  scales: number[]
}
