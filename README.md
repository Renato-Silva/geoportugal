# GeoPortugal

A modern front-end for the DGT's historical aerial photography archive
([Webfototeca](https://geo5.dgterritorio.gov.pt/fototeca/)): about 122,000 photos,
1944–2000, built with Nuxt 4, MapLibre GL and Tailwind CSS 4.

```sh
npm install
npm run dev          # http://localhost:3000  (use --port to change)
npm run build && node .output/server/index.mjs
```

## Install

### Proxmox VE (LXC)

Works like the [community-scripts.org](https://community-scripts.org) helpers, and uses their engine. Run this in
the Proxmox host shell:

```bash
bash -c "$(curl -fsSL https://raw.githubusercontent.com/Renato-Silva/geoportugal/master/ct/geoportugal.sh)"
```

Pick *Default* (Debian 13, unprivileged, 2 CPU, 2 GB RAM, 6 GB disk) or *Advanced* to change the container ID,
storage, network, resources and so on. The 2 GB of RAM is for the build. The 6 GB disk assumes imagery goes to S3
(see [Image storage](#image-storage)); without S3 the archive grows on local disk at about 1 MB per photo viewed.
When it finishes, it prints the URL (`http://<ip>:3000`).

Inside the container:

- Settings: edit `/opt/geoportugal/.env` (set the `NUXT_S3_*` values), then run `systemctl restart geoportugal`
- Update to the latest `master`: `update`
- Logs: `journalctl -u geoportugal -f`
- Imagery archive without S3: `/var/lib/geoportugal/archive`

The scripts are `ct/geoportugal.sh` (runs on the host) and `install/geoportugal-install.sh` (runs in the container).

### Docker

```bash
cp .env.example .env              # optional
docker compose up -d --build      # imagery archive in the "data" volume
```

The app listens on `127.0.0.1:3000` by default; put a TLS reverse proxy in front, or set `APP_BIND=0.0.0.0`.
The image runs as a non-root user.

## Features

- **Coverage map**: a country-wide grid of where the archive has photos, filterable by decade, with a
  "photos in this view" panel; click a cell to search it (data: `public/data/coverage.json`, see below)
- **This spot through time**: right-click anywhere (or search a point/place) for a time-lapse of every
  flight that photographed it, followed by the 2007–2023 orthophotos, at 300 m – 2.5 km
- **GIS downloads**: every PNG comes with a world file (`.pgw`), `.prj` and `.aux.xml` (EPSG:3857), and
  flights / selections / on-map photos can be exported as one georeferenced mosaic

- Search by **district / municipality / parish**, searched by the **exact boundary** (CAOP), not a rectangle
- Gazetteer place search (accent/typo tolerant: villages, landforms…), plus **map view**, **drawn box** or **clicked point**
- **Coverage timeline**: photos per year for the area, drag to filter a year range
- **Scale filter** with live counts
- Results grouped by flight (date · roll · scale), paged
- Footprints coloured by year, with hover synced between map and list. Clicking overlapping footprints opens a picker.
- Photos placed on the map with per-photo / global opacity, and optional film-border trimming
- **Then / now** swipe against DGT orthophotos of a chosen year (2007, 2010, 2012, 2015, 2018, 2021 or the 2023 satellite orthomosaic), with satellite imagery below zoom 10
- Basemaps: map, OpenStreetMap, satellite, DGT orthophotos 2007–2021 and OrtoSat 2023
- Optional administrative boundaries layer; each photo shows its parish and municipality
- **Carta Militar** (CIGeoE): the 1:500 000 *Carta Militar Itinerária* as a basemap, plus the
  1:25 000 sheet grid (M888 / M889 / P821) as an overlay; photos and search areas show their sheet numbers
- Photo viewer with zoom/pan, keyboard navigation, metadata, download
- Saved photos, recent searches and recently viewed (stored in the browser)
- Shareable URLs (view, area, filters, photos on the map, open photo)
- Exports: GeoJSON, KML, CSV, ZIP of original PNGs, map PNG
- Portuguese / English, light (default) and dark themes

## How it talks to DGT

| Data | Source | Path |
|---|---|---|
| Place search | CAOP name index (WFS) + DGT/INE gazetteer (`snic…/geonames`) | `/api/places` |
| Boundaries | CAOP WFS (`geo2…/caop_continente`, `caop_ram`, `caop_raa`), simplified | `/api/boundary`, `/api/locate` |
| Boundary lines | CAOP WMS (`*_trocos`) | browser → WMS directly |
| Carta Militar Itinerária 1:500 000 | CIGeoE WMS `cigeoe:carta_itineraria` (`webservices.igeoe.pt`) | `/api/itineraria` (XYZ tiles, PNG passthrough, archived — no CORS upstream) |
| 1:25 000 sheet index | CIGeoE WFS `cigeoe:cartograma_m888` / `m889` / `p821` | `/api/sheets` |
| Counts per year × scale | `geo5…/fototeca/agruparAnoEscala` (one call per decade) | proxied: `/api/summary` |
| Footprints + metadata | GeoServer WFS `dgt:Enquadramento_fotos_v2` | browser → WFS directly (POST; boundary polygons go inline in the CQL filter) |
| Photos | `geo5…/fototeca/imagem` | `/api/photo` (thumb/full WebP, original PNG) |
| Orthophotos 2007–2021, OrtoSat 2023 | `cartografia.dgterritorio.gov.pt/ortos{year}`, `ortos.dgterritorio.gov.pt/wms/ortosat2023` | `/api/ortho` (XYZ tiles, PNG passthrough) |

The geo5 endpoints and the orthophoto WMS can't be called from the browser:
geo5 sends no CORS headers, and the WMS sends a duplicated one.

## Coverage data

`public/data/coverage.json` is a pre-aggregated snapshot (≈160 KB gzipped) of all footprints:
2.5 km Web Mercator cells with photo counts per decade. Rebuild it when the archive changes:

```sh
npm run build:coverage   # ~25 sequential WFS requests, about a minute
```

## Georeferencing

Photos are placed by their footprint's bounding box, stretched linearly in Web Mercator
(the same way the map draws them). They are **not orthorectified**: expect offsets of tens of
metres, more in steep terrain. This applies to the map overlays, time-lapse crops, world files
and mosaics alike.

## Image storage

Each photo and orthophoto tile is fetched from DGT **once** and then served from the
`archive` storage (see `server/plugins/archive-storage.ts`):

- default: local disk, `.data/archive/`
- S3 or S3-compatible (AWS, Cloudflare R2, MinIO, Backblaze B2): set

```sh
NUXT_S3_BUCKET=my-bucket
NUXT_S3_REGION=eu-west-1            # "auto" for R2
NUXT_S3_ENDPOINT=https://…          # optional for AWS; required for R2/MinIO
NUXT_S3_ACCESS_KEY_ID=…
NUXT_S3_SECRET_ACCESS_KEY=…
```

## Password protection

Set `NUXT_SITE_PASSWORD` to require a password (HTTP Basic auth, any username) for the
app and its API. Leave it unset for public access.

Photos © DGT — Direção-Geral do Território.
