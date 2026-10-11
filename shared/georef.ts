// Georeferencing for downloads. Photos are placed by their footprint's bounding box,
// stretched linearly in Web Mercator — exactly how the map draws them — so the
// world files use EPSG:3857.

const R = 6378137

export type Bbox4326 = [number, number, number, number]

export function to3857(lon: number, lat: number): [number, number] {
  return [R * lon * Math.PI / 180, R * Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360))]
}

export function bboxTo3857([w, s, e, n]: Bbox4326): [number, number, number, number] {
  const [x0, y0] = to3857(w, s)
  const [x1, y1] = to3857(e, n)
  return [x0, y0, x1, y1]
}

/** ESRI world file (.pgw): pixel size, rotation (0) and the centre of the top-left pixel. */
export function worldFile(left: number, top: number, pixelX: number, pixelY: number) {
  return [pixelX, 0, 0, -pixelY, left + pixelX / 2, top - pixelY / 2].map(v => v.toFixed(10)).join('\n') + '\n'
}

/** World file for an image covering a 4326 bbox, linear in EPSG:3857. */
export function worldFileForBbox(bbox: Bbox4326, width: number, height: number) {
  const [x0, y0, x1, y1] = bboxTo3857(bbox)
  return worldFile(x0, y1, (x1 - x0) / width, (y1 - y0) / height)
}

export const WKT_3857 = 'PROJCS["WGS 84 / Pseudo-Mercator",GEOGCS["WGS 84",DATUM["WGS_1984",SPHEROID["WGS 84",6378137,298.257223563,AUTHORITY["EPSG","7030"]],AUTHORITY["EPSG","6326"]],PRIMEM["Greenwich",0,AUTHORITY["EPSG","8901"]],UNIT["degree",0.0174532925199433,AUTHORITY["EPSG","9122"]],AUTHORITY["EPSG","4326"]],PROJECTION["Mercator_1SP"],PARAMETER["central_meridian",0],PARAMETER["scale_factor",1],PARAMETER["false_easting",0],PARAMETER["false_northing",0],UNIT["metre",1,AUTHORITY["EPSG","9001"]],AXIS["Easting",EAST],AXIS["Northing",NORTH],EXTENSION["PROJ4","+proj=merc +a=6378137 +b=6378137 +lat_ts=0 +lon_0=0 +x_0=0 +y_0=0 +k=1 +units=m +nadgrids=@null +wktext +no_defs"],AUTHORITY["EPSG","3857"]]'

/** GDAL sidecar so QGIS picks up the CRS without asking. */
export const AUX_XML_3857 = `<PAMDataset>\n  <SRS>${WKT_3857.replace(/"/g, '&quot;')}</SRS>\n</PAMDataset>\n`

/** Sidecar files for `<name>.png`. */
export function sidecars(name: string, world: string): Record<string, string> {
  return {
    [`${name}.pgw`]: world,
    [`${name}.prj`]: WKT_3857,
    [`${name}.png.aux.xml`]: AUX_XML_3857,
  }
}

export const GEOREF_README_PT = `Georreferenciação aproximada

Cada imagem é colocada pelo retângulo envolvente da sua moldura (fonte: DGT),
esticada linearmente em Web Mercator (EPSG:3857). As fotografias não são
ortorretificadas: espere desvios de dezenas de metros, maiores em relevo acentuado.

Ficheiros: .png (imagem), .pgw (world file), .prj e .png.aux.xml (sistema de coordenadas).
Abra o .png no QGIS/ArcGIS — o georreferenciamento é lido automaticamente.

Approximate georeferencing: each image is placed by its footprint's bounding box,
stretched linearly in Web Mercator (EPSG:3857). Photos are not orthorectified;
expect offsets of tens of metres, more in steep terrain.
`

/** Width/height from a PNG header, without decoding the image. */
export function pngSize(buf: ArrayBuffer | Uint8Array): { width: number, height: number } | null {
  const b = buf instanceof Uint8Array ? buf : new Uint8Array(buf)
  if (b.length < 24 || b[0] !== 0x89 || b[1] !== 0x50) return null
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength)
  return { width: v.getUint32(16), height: v.getUint32(20) }
}

export function from3857(x: number, y: number): [number, number] {
  return [x / R * 180 / Math.PI, (2 * Math.atan(Math.exp(y / R)) - Math.PI / 2) * 180 / Math.PI]
}
