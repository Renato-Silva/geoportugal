#!/usr/bin/env node
// Builds public/data/coverage.json: a grid summarising where the archive has photos.
//
// Downloads every footprint once from DGT's WFS (≈25 requests, run sequentially to be
// gentle) and aggregates them into square cells in Web Mercator. For each cell we keep,
// per decade (1940s … 2000s):
//   cov — photos whose footprint overlaps the cell (for the coverage map)
//   ctr — photos whose footprint centre falls in the cell (for counting without duplicates)
//
// Usage: npm run build:coverage

import { mkdir, writeFile } from 'node:fs/promises'

const WFS = 'https://geo2.dgterritorio.gov.pt/geoserver/webfototeca/wfs'
const PAGE = 5000
const CELL = 2500 // metres in EPSG:3857 (≈1.9 km on the ground in mainland Portugal)
const DECADES = [1940, 1950, 1960, 1970, 1980, 1990, 2000]
const OUT = new URL('../public/data/coverage.json', import.meta.url)

async function page(startIndex) {
  const body = new URLSearchParams({
    service: 'WFS',
    version: '1.1.0',
    request: 'GetFeature',
    typename: 'dgt:Enquadramento_fotos_v2',
    outputFormat: 'application/json',
    srsname: 'EPSG:3857',
    propertyName: 'DATAFOTO,the_geom',
    maxFeatures: String(PAGE),
    startIndex: String(startIndex),
    sortBy: 'NUMROLO A,NUMFOTO A',
  })
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(WFS, { method: 'POST', body, signal: AbortSignal.timeout(120_000) })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return await res.json()
    }
    catch (e) {
      if (attempt >= 4) throw e
      console.warn(`  page ${startIndex} failed (${e.message}), retrying…`)
      await new Promise(r => setTimeout(r, 3000 * attempt))
    }
  }
}

const cells = new Map() // "ix,iy" → Int32Array(14): cov[0..6], ctr[0..6]
const cell = (ix, iy) => {
  const k = `${ix},${iy}`
  let c = cells.get(k)
  if (!c) cells.set(k, c = new Int32Array(DECADES.length * 2))
  return c
}

let total = 0, used = 0
for (let start = 0; ; start += PAGE) {
  const data = await page(start)
  const n = data.features.length
  for (const f of data.features) {
    total++
    const year = Number(String(f.properties.DATAFOTO ?? '').slice(0, 4))
    const d = DECADES.findIndex(dec => year >= dec && year < dec + 10)
    if (d < 0 || !f.geometry) continue
    const ring = f.geometry.type === 'Polygon' ? f.geometry.coordinates[0] : f.geometry.coordinates[0][0]
    let minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity
    for (const [x, y] of ring) {
      if (x < minx) minx = x
      if (y < miny) miny = y
      if (x > maxx) maxx = x
      if (y > maxy) maxy = y
    }
    used++
    for (let ix = Math.floor(minx / CELL); ix <= Math.floor(maxx / CELL); ix++)
      for (let iy = Math.floor(miny / CELL); iy <= Math.floor(maxy / CELL); iy++) cell(ix, iy)[d]++
    cell(Math.floor((minx + maxx) / 2 / CELL), Math.floor((miny + maxy) / 2 / CELL))[DECADES.length + d]++
  }
  console.log(`  ${start + n} footprints read`)
  if (n < PAGE) break
}

const rows = [...cells.entries()].map(([k, v]) => [...k.split(',').map(Number), ...v])
await mkdir(new URL('.', OUT), { recursive: true })
await writeFile(OUT, JSON.stringify({
  generated: new Date().toISOString(),
  cell: CELL,
  crs: 'EPSG:3857',
  decades: DECADES,
  photos: used,
  // [ix, iy, cov×7, ctr×7]; cell = [ix·cell, iy·cell] → [(ix+1)·cell, (iy+1)·cell]
  rows,
}))
console.log(`Done: ${used}/${total} dated footprints in ${rows.length} cells → ${OUT.pathname}`)
