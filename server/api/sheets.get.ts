/**
 * GET /api/sheets — sheet index of the Carta Militar de Portugal 1:25 000
 * (mainland M888, Azores M889, Madeira P821) from CIGeoE's WFS, as one
 * compact GeoJSON: { series, sheet, name? } per sheet.
 */
const WFS = 'https://webservices.igeoe.pt/geoserver/wfs'

interface Feature {
  geometry: { type: 'Polygon' | 'MultiPolygon', coordinates: any }
  properties: Record<string, string | number | null>
}

async function layer(typename: string) {
  const qs = new URLSearchParams({
    service: 'WFS', version: '1.1.0', request: 'GetFeature', typename,
    outputFormat: 'application/json', srsname: 'EPSG:4326',
  })
  const data = await $fetch(`${WFS}?${qs}`, { timeout: 60_000, retry: 1 }) as { features: Feature[] }
  return data.features
}

const round = (c: any): any => typeof c[0] === 'number' ? [+c[0].toFixed(5), +c[1].toFixed(5)] : c.map(round)

export default defineCachedEventHandler(async () => {
  const [m888, m889, p821] = await Promise.all([
    layer('cigeoe:cartograma_m888'),
    layer('cigeoe:cartograma_m889'),
    layer('cigeoe:cartograma_p821'),
  ])
  const pick = (series: string, list: Feature[], sheetKey: string, nameKey?: string) => list.map(f => ({
    type: 'Feature' as const,
    properties: {
      series,
      sheet: String(f.properties[sheetKey] ?? '').trim(),
      ...(nameKey && f.properties[nameKey] ? { name: String(f.properties[nameKey]) } : {}),
    },
    geometry: { type: f.geometry.type, coordinates: round(f.geometry.coordinates) },
  })).filter(f => f.properties.sheet)
  return {
    type: 'FeatureCollection',
    features: [...pick('M888', m888, 'FOLHA'), ...pick('M889', m889, 'FOLHA', 'NOME'), ...pick('P821', p821, '_FOLHA')],
  }
}, { maxAge: 60 * 60 * 24 * 30, name: 'sheets', getKey: () => 'v1' })
