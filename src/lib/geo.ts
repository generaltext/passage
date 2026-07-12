// geo.ts — the offline geography layer. All lookups run against bundled tables;
// nothing is fetched at runtime.
//   - countries.json / us-states.json are tiny, imported eagerly.
//   - airports.json (~400 KB) is lazy-loaded as its own chunk the first time we
//     need it (the map, stats, or a flight lookup).

import COUNTRIES_RAW from '~/data/countries.json'
import US_STATES_RAW from '~/data/us-states.json'

export type Airport = { iata: string; name: string; city: string; a2: string; lat: number; lon: number }

/** a2 -> [displayName, topojsonNumericId] */
const COUNTRIES = COUNTRIES_RAW as unknown as Record<string, [string, string]>
/** postal -> [name, fipsId] */
const US_STATES = US_STATES_RAW as unknown as Record<string, [string, string]>

const NUM_TO_A2 = new Map<string, string>()
for (const [a2, [, num]] of Object.entries(COUNTRIES)) NUM_TO_A2.set(num, a2)

// Friendlier display names where the ISO canonical form is a mouthful.
const SHORT_NAMES: Record<string, string> = {
  US: 'United States',
  GB: 'United Kingdom',
  RU: 'Russia',
  KR: 'South Korea',
  KP: 'North Korea',
  IR: 'Iran',
  SY: 'Syria',
  VE: 'Venezuela',
  BO: 'Bolivia',
  TZ: 'Tanzania',
  MD: 'Moldova',
  LA: 'Laos',
  VN: 'Vietnam',
  CD: 'DR Congo',
  CG: 'Congo',
  TW: 'Taiwan',
  BN: 'Brunei',
  MK: 'North Macedonia',
  TR: 'Turkey',
}

export const countryName = (a2: string): string => SHORT_NAMES[a2] ?? COUNTRIES[a2]?.[0] ?? a2
export const countryNum = (a2: string): string | undefined => COUNTRIES[a2]?.[1]
export const a2FromNum = (num: string): string | undefined => NUM_TO_A2.get(num)
export const isCountry = (a2: string): boolean => a2 in COUNTRIES

export const stateName = (postal: string): string => US_STATES[postal]?.[0] ?? postal
export const stateFips = (postal: string): string | undefined => US_STATES[postal]?.[1]
export const isUsState = (postal: string): boolean => postal in US_STATES

// --- airport table (lazy) ---
let airportsPromise: Promise<Record<string, Airport>> | null = null
export function loadAirports(): Promise<Record<string, Airport>> {
  if (!airportsPromise) {
    airportsPromise = import('~/data/airports.json').then((m) => {
      const raw = m.default as unknown as Record<string, [string, string, string, number, number]>
      const out: Record<string, Airport> = {}
      for (const [iata, [name, city, a2, lat, lon]] of Object.entries(raw)) {
        out[iata] = { iata, name, city, a2, lat, lon }
      }
      return out
    })
  }
  return airportsPromise
}

// --- city gazetteer (lazy) — resolves non-flight endpoints and stays by name ---
export type CityRow = [string, number, number, string, string] // name, lat, lon, cc, admin1
export interface Cities {
  list: CityRow[]
  byName: Map<string, number[]> // norm(name) -> row indices (pop-desc)
}
let citiesPromise: Promise<Cities> | null = null
export function loadCities(): Promise<Cities> {
  if (!citiesPromise) {
    citiesPromise = import('~/data/cities.json').then((m) => {
      const list = m.default as unknown as CityRow[]
      const byName = new Map<string, number[]>()
      list.forEach((c, i) => {
        const k = norm(c[0])
        const arr = byName.get(k)
        if (arr) arr.push(i)
        else byName.set(k, [i])
      })
      return { list, byName }
    })
  }
  return citiesPromise
}

/** The combined offline geo index the map + resolver need. */
export interface GeoIndex {
  airports: Record<string, Airport>
  cities: Cities
}
export function loadGeoIndex(): Promise<GeoIndex> {
  return Promise.all([loadAirports(), loadCities()]).then(([airports, cities]) => ({ airports, cities }))
}

const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

export interface PlacePoint {
  lat: number
  lon: number
  label: string
  a2?: string
  state?: string // US postal
  kind: 'airport' | 'city' | 'coord'
}

/** Resolve a trip/stay endpoint to a plottable/paintable point, fully offline.
 *  Order: explicit coords → @lat,lon → IATA (airport) → city gazetteer. */
export function resolveEndpoint(
  index: GeoIndex,
  token: string,
  coords?: { lat?: number; lon?: number },
): PlacePoint | null {
  const t = (token || '').trim()
  if (coords && typeof coords.lat === 'number' && typeof coords.lon === 'number') {
    return { lat: coords.lat, lon: coords.lon, label: t || 'Pin', kind: 'coord' }
  }
  if (!t) return null
  if (t.startsWith('@')) {
    const [la, lo] = t.slice(1).split(',').map(Number)
    if (isFinite(la!) && isFinite(lo!)) return { lat: la!, lon: lo!, label: t, kind: 'coord' }
  }
  const up = t.toUpperCase()
  if (/^[A-Z]{3}$/.test(up) && index.airports[up]) {
    const a = index.airports[up]!
    return { lat: a.lat, lon: a.lon, label: `${a.city} · ${up}`, a2: a.a2, kind: 'airport' }
  }
  return resolveCity(index.cities, t)
}

function resolveCity(cities: Cities, token: string): PlacePoint | null {
  const comma = token.lastIndexOf(',')
  let name = token
  let region: string | undefined
  if (comma > 0) {
    name = token.slice(0, comma).trim()
    region = token.slice(comma + 1).trim().toUpperCase()
  }
  const idxs = cities.byName.get(norm(name))
  if (!idxs || !idxs.length) return null
  let pick = idxs[0]!
  if (region) {
    const m = idxs.find((i) => {
      const c = cities.list[i]!
      return c[3] === region || c[4] === region
    })
    if (m != null) pick = m
  }
  const c = cities.list[pick]!
  const a2 = c[3]
  const state = a2 === 'US' && isUsState(c[4]) ? c[4] : undefined
  const out: PlacePoint = { lat: c[1], lon: c[2], label: region ? `${c[0]}, ${region}` : c[0], kind: 'city' }
  if (a2) out.a2 = a2
  if (state) out.state = state
  return out
}

// --- distance ---
export const KM_PER_MILE = 1.609344
const R_KM = 6371.0088
export function haversineKm(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(bLat - aLat)
  const dLon = toRad(bLon - aLon)
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLon / 2) ** 2
  return 2 * R_KM * Math.asin(Math.min(1, Math.sqrt(s)))
}

// --- place tokens (places/<person>.txt lines, visit codes, visit place text) ---
export interface ParsedPlace {
  label: string
  country?: string // a2
  state?: string // US postal
  city?: string
  lat?: number
  lon?: number
}

/** Parse one place token into paintable/plottable parts. Forgiving: unknown
 *  tokens still return a label so nothing is silently dropped. Grammar:
 *    PT               country
 *    US-CA            US state
 *    city:Lisbon,PT   named city in a country
 *    @44.46,-72.69    raw coordinate
 *    "Stowe, VT"      free text; trailing US state or country code is detected
 */
export function parsePlace(token: string): ParsedPlace {
  const t = token.trim()
  if (!t) return { label: '' }

  if (t.startsWith('@')) {
    const [latS, lonS] = t.slice(1).split(',')
    const lat = Number(latS)
    const lon = Number(lonS)
    if (isFinite(lat) && isFinite(lon)) return { label: t, lat, lon }
    return { label: t }
  }

  const cityM = /^city:(.+?),\s*([A-Za-z]{2})$/.exec(t)
  if (cityM) {
    const city = cityM[1]!.trim()
    const a2 = cityM[2]!.toUpperCase()
    return { label: city, city, country: isCountry(a2) ? a2 : undefined }
  }

  if (/^[A-Z]{2}$/.test(t) && isCountry(t)) return { label: countryName(t), country: t }

  const subM = /^([A-Z]{2})-([A-Z0-9]{1,3})$/.exec(t)
  if (subM) {
    const [, cc, sub] = subM
    if (cc === 'US' && isUsState(sub!)) return { label: stateName(sub!), state: sub!, country: 'US' }
    return { label: t, country: isCountry(cc!) ? cc! : undefined }
  }

  // free text: "City, XX" — detect a trailing US state or country code
  const comma = t.lastIndexOf(',')
  if (comma > 0) {
    const head = t.slice(0, comma).trim()
    const tail = t.slice(comma + 1).trim().toUpperCase()
    if (isUsState(tail)) return { label: t, city: head, state: tail, country: 'US' }
    if (isCountry(tail)) return { label: t, city: head, country: tail }
  }
  return { label: t }
}
