/**
 * Thematic maps that can be laid over the photos: DGT's Agricultural and Forest Map
 * (1951–80) and the land-use and land-cover map series (COS), mainland Portugal.
 * COS series 1 (1995–2018) and series 2 (2018–) use different nomenclatures.
 */
const GEO2 = 'https://geo2.dgterritorio.gov.pt/geoserver'

export const THEMATIC_LAYERS = {
  maf: { ws: 'maf', layer: 'MAF1951_1980', label: '1951–80' },
  cos1995: { ws: 'COS-S1', layer: 'COS1995v2-S1', label: '1995' },
  cos2007: { ws: 'COS-S1', layer: 'COS2007v3-S1', label: '2007' },
  cos2010: { ws: 'COS-S1', layer: 'COS2010v2-S1', label: '2010' },
  cos2015: { ws: 'COS-S1', layer: 'COS2015v2-S1', label: '2015' },
  cos2018: { ws: 'COS-S2', layer: 'cos2018v4-s2', label: '2018' },
  cos2023: { ws: 'COS-S2', layer: 'cos2023v1-s2', label: '2023' },
  cos2025: { ws: 'COS-S2', layer: 'cos2025v1-s2', label: '2025' },
} as const

export type ThematicId = keyof typeof THEMATIC_LAYERS
export const THEMATIC_IDS = Object.keys(THEMATIC_LAYERS) as ThematicId[]
export const COS_IDS = THEMATIC_IDS.filter(id => id.startsWith('cos'))

export const isThematicId = (id: unknown): id is ThematicId => typeof id === 'string' && id in THEMATIC_LAYERS

export function thematicWms(id: ThematicId) {
  const { ws } = THEMATIC_LAYERS[id]
  return `${GEO2}/${ws}/wms`
}

/** GeoServer's own legend image for a layer. */
export function thematicLegendUrl(id: ThematicId) {
  const { layer } = THEMATIC_LAYERS[id]
  return `${thematicWms(id)}?service=WMS&version=1.1.1&request=GetLegendGraphic&format=image/png&layer=${layer}`
}
