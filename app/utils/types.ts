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

export type AreaKind = 'place' | 'admin' | 'view' | 'box' | 'point'
export type AdminLevel = 'district' | 'municipality' | 'parish'

export interface Area {
  kind: AreaKind
  label: string
  bbox: Bbox
  /** for point / place searches: the location itself */
  point?: [number, number]
  /** for administrative areas: which unit (its boundary is fetched on demand) */
  admin?: { level: AdminLevel, code: string }
}

export interface Boundary {
  level: AdminLevel
  code: string
  name: string
  context: string
  bbox: Bbox
  geometry: GeoJSON.MultiPolygon
  /** simplified polygon in EPSG:3763, for WFS filters */
  wkt: string
}

export interface AdminUnit {
  level: AdminLevel
  code: string
  name: string
  municipality?: string
  district: string
}

export interface GeoPlace {
  id: string
  name: string
  type: string
  municipality: string | null
  parish: string | null
  point: [number, number]
}

export interface PlaceResults {
  admin: AdminUnit[]
  places: GeoPlace[]
}

export interface PhotoLocation {
  parish?: { code: string, name: string }
  municipality?: string
  district?: string
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
  /** exact area (EPSG:3763 WKT); when set it replaces the bbox test */
  wkt?: string
  years: [number, number]
  scales: number[]
}
