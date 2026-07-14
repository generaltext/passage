# Passage

A General Text app: a lifelong, plaintext record of every flight, place, and stay, painted onto a map. https://www.generaltext.org

Built against the app guide: https://www.generaltext.org/llms.txt
(local source: `projects/generaltext/content/docs/building-apps.md`).

Storage scope: `_gtApps/passage/data/` (your writable folder; versioned as `data/v1/`).

## Develop

```
pnpm install
pnpm dev        # standalone, with an in-browser workspace injected by vite.config
pnpm build      # tsc + vite build -> dist/
pnpm preview
```

## Bundled reference data (offline, no runtime network)

`pnpm data` regenerates the compact tables under `src/data/` from raw sources
(OpenFlights airports, ISO 3166, world-atlas + us-atlas TopoJSON). The raw
sources are fetched separately into a scratch dir; see `scripts/build-data.mjs`
for the expected inputs (`SRC_DIR`). The generated tables are committed so a
normal `pnpm build` needs no network.

- `src/data/airports.json` · `{ IATA: [name, city, countryA2, lat, lon] }`
- `src/data/cities.json` · `[name, lat, lon, cc, admin1][]`, population-desc. Hybrid
  gazetteer: every US populated place (GeoNames `US.txt`, feature class P: no
  population floor, so tiny towns appear) + the rest of the world from
  `cities5000`. Powers place autocomplete + non-flight endpoint resolution. ~256k
  entries (~3.6 MB gzipped), lazy-loaded.
- `src/data/countries.json` · `{ A2: [name, topojsonNumericId] }`
- `src/data/us-states.json` · `{ Postal: [name, fipsId] }`
- `src/data/world-10m.json` · Natural Earth 10m admin-0, simplified to ~12% of
  vertices (mapshaper, `keep-shapes`) as TopoJSON (features carry `properties.a2`
  + `properties.name`). Simplification matters: full 10m (~478k pts) froze the
  main thread when globe.gl triangulated the country fills; ~12% (~61k pts, 222 KB
  gz) stays crisp but triangulates fast. See `scripts/build-data.mjs` for the
  `ogr2ogr` + `mapshaper` conversion.
- `src/data/us-states-10m.json` · us-atlas states TopoJSON (revealed on zoom)

## Data format

The user-facing description of the files Passage writes lives in
`public/gt-readme.md` (the gallery README). The canonical schema is documented
in-app under the "Format" panel.
