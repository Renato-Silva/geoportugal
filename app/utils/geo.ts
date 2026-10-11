import type { Bbox } from './types'

export function bboxOfRing(ring: number[][]): Bbox {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const [x, y] of ring) {
    if (x! < minX) minX = x!
    if (y! < minY) minY = y!
    if (x! > maxX) maxX = x!
    if (y! > maxY) maxY = y!
  }
  return [minX, minY, maxX, maxY]
}

export function unionBbox(boxes: Bbox[]): Bbox | null {
  if (!boxes.length) return null
  return boxes.reduce((a, b) => [
    Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3]),
  ])
}

export function bboxPolygon(b: Bbox): GeoJSON.Polygon {
  return {
    type: 'Polygon',
    coordinates: [[[b[0], b[1]], [b[2], b[1]], [b[2], b[3]], [b[0], b[3]], [b[0], b[1]]]],
  }
}

/** Image corners for a MapLibre image source: TL, TR, BR, BL */
export function bboxCorners(b: Bbox): [[number, number], [number, number], [number, number], [number, number]] {
  return [[b[0], b[3]], [b[2], b[3]], [b[2], b[1]], [b[0], b[1]]]
}

/** A tiny box around a point, used for "photos covering this spot" searches. */
export function pointBbox([lng, lat]: [number, number], radius = 0.0002): Bbox {
  return [lng - radius, lat - radius, lng + radius, lat + radius]
}

export function roundBbox(b: Bbox, digits = 5): Bbox {
  return b.map(n => Number(n.toFixed(digits))) as Bbox
}

export function parseBbox(raw: string | null | undefined): Bbox | null {
  if (!raw) return null
  const parts = raw.split(',').map(Number)
  return parts.length === 4 && parts.every(Number.isFinite) ? parts as Bbox : null
}

/** Rough bounds of mainland Portugal + islands, used to clamp "search this view". */
export const PORTUGAL_BBOX: Bbox = [-31.5, 32.4, -6.1, 42.2]
