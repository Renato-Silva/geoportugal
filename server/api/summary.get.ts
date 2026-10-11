import { DECADES, fetchLegacyJson, parseBboxParam } from '../utils/fototeca'

export interface YearScaleCount {
  year: number
  scale: number
  count: number
}

interface AgruparResponse {
  results: Array<{ 'ano': number, 'escala': number, 'total fotos': number }>
}

/** Photo counts per year and scale inside a bbox, across every decade in the archive. */
export default defineCachedEventHandler(async (event): Promise<YearScaleCount[]> => {
  const bbox = parseBboxParam(getQuery(event).bbox)
  const perDecade = await Promise.all(DECADES.map(decada =>
    fetchLegacyJson<AgruparResponse>('agruparAnoEscala', {
      bbox: bbox.join(','),
      epsgcode: '4326',
      decada: String(decada),
    }),
  ))
  return perDecade
    .flatMap(r => r.results ?? [])
    .map(r => ({ year: r.ano, scale: r.escala, count: r['total fotos'] }))
    .sort((a, b) => a.year - b.year || a.scale - b.scale)
}, {
  maxAge: 60 * 60 * 24,
  name: 'summary',
  getKey: event => parseBboxParam(getQuery(event).bbox).map(n => n.toFixed(5)).join(','),
})
