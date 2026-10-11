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

Pick *Default* (Debian 13, unprivileged, 2 CPU, 2 GB RAM, 20 GB disk) or *Advanced* to change the container ID,
storage, network, resources and so on. The 2 GB of RAM is for the build. The disk holds the imagery archive,
which grows as photos are viewed (see [Image storage](#image-storage)). When it finishes, it prints the URL
(`http://<ip>:3000`).

Inside the container:

- Settings: edit `/opt/geoportugal/.env` (e.g. S3 storage), then run `systemctl restart geoportugal`
- Update to the latest `master`: `update`
- Logs: `journalctl -u geoportugal -f`
- Imagery archive: `/var/lib/geoportugal/archive`

The scripts are `ct/geoportugal.sh` (runs on the host) and `install/geoportugal-install.sh` (runs in the container).

### Docker

```bash
cp .env.example .env              # optional
docker compose up -d --build      # imagery archive in the "data" volume
```

The app listens on `127.0.0.1:3000` by default; put a TLS reverse proxy in front, or set `APP_BIND=0.0.0.0`.
The image runs as a non-root user.

## Features

- Place search with autocomplete; search by **map view**, **drawn box** or **clicked point**
- **Coverage timeline**: photos per year for the area, drag to filter a year range
- **Scale filter** with live counts
- Results grouped by flight (date · roll · scale), paged
- Footprints coloured by year, with hover synced between map and list. Clicking overlapping footprints opens a picker.
- Photos placed on the map with per-photo / global opacity, and optional film-border trimming
- **Then / now** swipe against DGT orthophotos of a chosen year (2007, 2010, 2012, 2015, 2018 or 2021), with satellite imagery below zoom 10
- Basemaps: map, OpenStreetMap, satellite, DGT orthophotos 2007 / 2010 / 2012 / 2015 / 2018 / 2021
- Photo viewer with zoom/pan, keyboard navigation, metadata, download
- Saved photos, recent searches and recently viewed (stored in the browser)
- Shareable URLs (view, area, filters, photos on the map, open photo)
- Exports: GeoJSON, KML, CSV, ZIP of original PNGs, map PNG
- Portuguese / English, light (default) and dark themes

## How it talks to DGT

| Data | Source | Path |
|---|---|---|
| Place names | `geo5…/fototeca/toponimia` | proxied: `/api/places` |
| Counts per year × scale | `geo5…/fototeca/agruparAnoEscala` (one call per decade) | proxied: `/api/summary` |
| Footprints + metadata | GeoServer WFS `dgt:Enquadramento_fotos_v2` | browser → WFS directly (CORS ok) |
| Photos | `geo5…/fototeca/imagem` | `/api/photo` (thumb/full WebP, original PNG) |
| Orthophotos 2007–2021 | `cartografia.dgterritorio.gov.pt/ortos{year}` WMS | `/api/ortho` (XYZ tiles, PNG passthrough) |

The geo5 endpoints and the orthophoto WMS can't be called from the browser:
geo5 sends no CORS headers, and the WMS sends a duplicated one.

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

Photos © DGT — Direção-Geral do Território.
