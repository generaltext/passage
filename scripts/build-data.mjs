// build-data.mjs — turn the raw reference datasets into the compact, bundled
// tables Passage ships. Run once at authoring time (not at app runtime): the app
// never fetches anything. Sources (fetched separately into SRC_DIR):
//   airports.dat        OpenFlights airport table (CSV)
//   iso3166.json        ISO 3166 countries (numeric <-> alpha-2 <-> name)
//   countries-110m.json world-atlas TopoJSON (countries; numeric ids)
//   states-10m.json     us-atlas TopoJSON (US states; FIPS ids)
//
// Emits into src/data/:
//   airports.json   { IATA: [name, city, a2, lat, lon] }  (lazy-loaded chunk)
//   countries.json  { A2: [name, numericId] }              (topojson id <-> a2)
//   us-states.json  { PostalCode: [name, fipsId] }
//   world-110m.json / us-states-10m.json  (copied topojson)
//
// If OpenFlights uses a country spelling ISO doesn't, add it to ALIASES below;
// the script prints any still-unmatched country names at the end.

import { readFileSync, writeFileSync, copyFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SRC_DIR = process.env.SRC_DIR || resolve(__dirname, '../../../../.tmp-passage-data')
const OUT = resolve(__dirname, '../src/data')

const src = (f) => resolve(SRC_DIR, f)

// --- ISO 3166: build name/variant -> alpha-2, and alpha-2 -> [name, numeric] ---
const iso = JSON.parse(readFileSync(src('iso3166.json'), 'utf8'))
const nameToA2 = new Map()
const countries = {} // a2 -> [displayName, numericId]
const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
for (const c of iso) {
  const a2 = c['alpha-2']
  const num = c['country-code'] // 3-digit zero-padded, matches world-atlas topojson ids ("076")
  countries[a2] = [c.name, num]
  nameToA2.set(norm(c.name), a2)
}

// OpenFlights spellings that differ from ISO canonical names.
const ALIASES = {
  'united states': 'US',
  'russia': 'RU',
  'south korea': 'KR',
  'north korea': 'KP',
  'vietnam': 'VN',
  'laos': 'LA',
  'syria': 'SY',
  'iran': 'IR',
  'taiwan': 'TW',
  'tanzania': 'TZ',
  'bolivia': 'BO',
  'venezuela': 'VE',
  'moldova': 'MD',
  'macedonia': 'MK',
  'north macedonia': 'MK',
  'czech republic': 'CZ',
  'brunei': 'BN',
  'ivory coast': 'CI',
  "cote d ivoire": 'CI',
  'cape verde': 'CV',
  'democratic republic of the congo': 'CD',
  'congo kinshasa': 'CD',
  'congo brazzaville': 'CG',
  'republic of the congo': 'CG',
  'congo': 'CG',
  'burma': 'MM',
  'myanmar': 'MM',
  'palestine': 'PS',
  'east timor': 'TL',
  'timor leste': 'TL',
  'swaziland': 'SZ',
  'eswatini': 'SZ',
  'micronesia': 'FM',
  'federated states of micronesia': 'FM',
  'united kingdom': 'GB',
  'macau': 'MO',
  'hong kong': 'HK',
  'south sudan': 'SS',
  'kosovo': 'XK',
  'reunion': 'RE',
  'saint helena': 'SH',
  'falkland islands': 'FK',
  'western sahara': 'EH',
  'netherlands antilles': 'CW',
  'curacao': 'CW',
  'virgin islands': 'VI',
  'british virgin islands': 'VG',
  'wallis and futuna': 'WF',
  'saint vincent and the grenadines': 'VC',
  'bonaire': 'BQ',
  'turkey': 'TR',
  'turkiye': 'TR',
  'netherlands': 'NL',
  'midway islands': 'UM',
  'johnston atoll': 'UM',
  'wake island': 'UM',
}
const resolveA2 = (countryName) => {
  const n = norm(countryName)
  return ALIASES[n] || nameToA2.get(n) || null
}

// --- airports.dat -> { IATA: [name, city, a2, lat, lon] } ---
function parseCsvLine(line) {
  const out = []
  let cur = ''
  let q = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (q) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++ } else q = false
      } else cur += ch
    } else if (ch === '"') q = true
    else if (ch === ',') { out.push(cur); cur = '' }
    else cur += ch
  }
  out.push(cur)
  return out
}

const airports = {}
const unmatched = new Map()
const round = (n) => Math.round(parseFloat(n) * 1e4) / 1e4
for (const line of readFileSync(src('airports.dat'), 'utf8').split('\n')) {
  if (!line.trim()) continue
  const f = parseCsvLine(line)
  const [, name, city, country, iata, , latS, lonS] = f
  if (!iata || iata === '\\N' || !/^[A-Z]{3}$/.test(iata)) continue
  const lat = round(latS)
  const lon = round(lonS)
  if (!isFinite(lat) || !isFinite(lon)) continue
  const a2 = resolveA2(country)
  if (!a2) unmatched.set(country, (unmatched.get(country) || 0) + 1)
  // Trim " Airport"/"International" noise lightly for display, keep it simple.
  airports[iata] = [name, city, a2 || '', lat, lon]
}

// --- US states: postal -> [name, fips] (fips == us-atlas feature id) ---
const US_STATES = {
  AL: ['Alabama', '01'], AK: ['Alaska', '02'], AZ: ['Arizona', '04'], AR: ['Arkansas', '05'],
  CA: ['California', '06'], CO: ['Colorado', '08'], CT: ['Connecticut', '09'], DE: ['Delaware', '10'],
  DC: ['District of Columbia', '11'], FL: ['Florida', '12'], GA: ['Georgia', '13'], HI: ['Hawaii', '15'],
  ID: ['Idaho', '16'], IL: ['Illinois', '17'], IN: ['Indiana', '18'], IA: ['Iowa', '19'],
  KS: ['Kansas', '20'], KY: ['Kentucky', '21'], LA: ['Louisiana', '22'], ME: ['Maine', '23'],
  MD: ['Maryland', '24'], MA: ['Massachusetts', '25'], MI: ['Michigan', '26'], MN: ['Minnesota', '27'],
  MS: ['Mississippi', '28'], MO: ['Missouri', '29'], MT: ['Montana', '30'], NE: ['Nebraska', '31'],
  NV: ['Nevada', '32'], NH: ['New Hampshire', '33'], NJ: ['New Jersey', '34'], NM: ['New Mexico', '35'],
  NY: ['New York', '36'], NC: ['North Carolina', '37'], ND: ['North Dakota', '38'], OH: ['Ohio', '39'],
  OK: ['Oklahoma', '40'], OR: ['Oregon', '41'], PA: ['Pennsylvania', '42'], RI: ['Rhode Island', '44'],
  SC: ['South Carolina', '45'], SD: ['South Dakota', '46'], TN: ['Tennessee', '47'], TX: ['Texas', '48'],
  UT: ['Utah', '49'], VT: ['Vermont', '50'], VA: ['Virginia', '51'], WA: ['Washington', '53'],
  WV: ['West Virginia', '54'], WI: ['Wisconsin', '55'], WY: ['Wyoming', '56'],
}

// --- cities gazetteer -> [name, lat, lon, cc, admin1], population-desc ---
// Resolves non-flight trip endpoints and stays by name, and powers the place
// autocomplete. A hybrid for coverage without a giant world file:
//   US.txt      ALL US populated places (feature class P, no population floor)
//               so tiny towns GeoNames records with pop 0 still appear
//               (Warren VT, Killington VT, …). ~194k.
//   cities5000  the rest of the world at population >= 5000. ~62k after dropping US.
// Sorted by population so a bare name resolves to the largest matching city.
let cities = []
try {
  const rows = []
  const take = (line, forceCc) => {
    const f = line.split('\t')
    if (!f[1]) return null
    const lat = round(f[4])
    const lon = round(f[5])
    if (!isFinite(lat) || !isFinite(lon)) return null
    return [f[1], lat, lon, forceCc || f[8], f[10] || '', parseInt(f[14], 10) || 0]
  }
  for (const line of readFileSync(src('US.txt'), 'utf8').split('\n')) {
    if (!line) continue
    const f = line.split('\t')
    if (f[6] !== 'P') continue // populated places only
    const r = take(line, 'US')
    if (r) rows.push(r)
  }
  for (const line of readFileSync(src('cities5000.txt'), 'utf8').split('\n')) {
    if (!line) continue
    if (line.split('\t')[8] === 'US') continue // US covered above
    const r = take(line)
    if (r) rows.push(r)
  }
  rows.sort((a, b) => b[5] - a[5])
  cities = rows.map((r) => [r[0], r[1], r[2], r[3], r[4]]) // drop pop after sort
  writeFileSync(resolve(OUT, 'cities.json'), JSON.stringify(cities))
} catch (e) {
  console.log('US.txt / cities5000.txt not found — skipping cities.json', e.message)
}

writeFileSync(resolve(OUT, 'airports.json'), JSON.stringify(airports))
writeFileSync(resolve(OUT, 'countries.json'), JSON.stringify(countries))
writeFileSync(resolve(OUT, 'us-states.json'), JSON.stringify(US_STATES))
copyFileSync(src('states-10m.json'), resolve(OUT, 'us-states-10m.json'))
// world-10m.json (filled land; coastlines stay crisp when zoomed) is produced
// out-of-band from Natural Earth 10m admin-0. It is SIMPLIFIED to ~12% of the
// vertices: full 10m froze the main thread when globe.gl triangulates the fills.
//   ogr2ogr -f GeoJSON ne10.min.geojson ne_10m_admin_0_countries.geojson \
//     -dialect OGRSQL -sql 'SELECT ISO_A2_EH AS a2, NAME AS name FROM "ne_10m_admin_0_countries"'
//   npx mapshaper ne10.min.geojson -simplify 12% keep-shapes \
//     -o precision=0.001 format=topojson src/data/world-10m.json
//   # then rename the topojson object key to "countries"
// (kept committed; features carry properties.a2 + properties.name)

const n = Object.keys(airports).length
console.log(`airports: ${n} with IATA`)
console.log(`cities: ${cities.length}`)
console.log(`countries: ${Object.keys(countries).length}`)
if (unmatched.size) {
  const top = [...unmatched.entries()].sort((a, b) => b[1] - a[1])
  console.log(`\nUNMATCHED country names (${unmatched.size}) — add aliases if these matter:`)
  for (const [c, cnt] of top) console.log(`  ${cnt.toString().padStart(4)}  ${c}`)
} else {
  console.log('all airport countries matched ✓')
}
