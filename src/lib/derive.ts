// derive.ts — turn people + trips + stays + manual places into geography:
// visited regions (with provenance), the arcs and points the map draws, and a
// region -> items index for click-to-inspect. Pure over an already-loaded
// GeoIndex.

import type { Stay, Trip } from '~/lib/types'
import { type GeoIndex, type PlacePoint, parsePlace, resolveEndpoint } from '~/lib/geo'

export type RegionSource = 'trip' | 'stay' | 'manual'

export interface PersonRegions {
  countries: Map<string, Set<RegionSource>>
  states: Map<string, Set<RegionSource>>
}

export interface TArc {
  key: string
  type: Trip['type']
  personIds: string[]
  from: PlacePoint
  to: PlacePoint
  date?: string
  tripId: string
}

export interface TPoint {
  key: string
  lat: number
  lon: number
  kind: 'airport' | 'city' | 'stay' | 'coord'
  label: string
  personIds: string[]
  tripIds: string[]
  stayIds: string[]
}

export interface RegionItems {
  tripIds: Set<string>
  stayIds: Set<string>
}

export interface DerivedGeo {
  byPerson: Record<string, PersonRegions>
  arcs: TArc[]
  points: TPoint[]
  regionItems: Map<string, RegionItems> // code: a2 or "US-XX"
}

function ensure(byPerson: Record<string, PersonRegions>, id: string): PersonRegions {
  let r = byPerson[id]
  if (!r) byPerson[id] = r = { countries: new Map(), states: new Map() }
  return r
}
function addSource(map: Map<string, Set<RegionSource>>, key: string, src: RegionSource) {
  let s = map.get(key)
  if (!s) map.set(key, (s = new Set()))
  s.add(src)
}

export function deriveGeo(
  people: { id: string }[],
  trips: Trip[],
  stays: Stay[],
  placesByPerson: Record<string, string[]>,
  index: GeoIndex,
): DerivedGeo {
  const byPerson: Record<string, PersonRegions> = {}
  for (const p of people) ensure(byPerson, p.id)

  const arcs: TArc[] = []
  const pointMap = new Map<string, TPoint>() // keyed by rounded lat,lon
  const regionItems = new Map<string, RegionItems>()

  const region = (code: string): RegionItems => {
    let r = regionItems.get(code)
    if (!r) regionItems.set(code, (r = { tripIds: new Set(), stayIds: new Set() }))
    return r
  }
  const pointKey = (lat: number, lon: number) => `${lat.toFixed(3)},${lon.toFixed(3)}`
  const addPoint = (
    p: PlacePoint,
    kind: TPoint['kind'],
    who: string[],
    ref: { tripId?: string; stayId?: string },
  ) => {
    const key = pointKey(p.lat, p.lon)
    let pt = pointMap.get(key)
    if (!pt) pointMap.set(key, (pt = { key, lat: p.lat, lon: p.lon, kind, label: p.label, personIds: [], tripIds: [], stayIds: [] }))
    for (const w of who) if (!pt.personIds.includes(w)) pt.personIds.push(w)
    if (ref.tripId && !pt.tripIds.includes(ref.tripId)) pt.tripIds.push(ref.tripId)
    if (ref.stayId && !pt.stayIds.includes(ref.stayId)) pt.stayIds.push(ref.stayId)
    if (kind === 'stay') pt.kind = 'stay' // a stay label/pin wins over a passing airport
  }

  const paint = (p: PlacePoint, who: string[], src: RegionSource, ref: { tripId?: string; stayId?: string }) => {
    if (p.a2) {
      region(p.a2)
      if (ref.tripId) region(p.a2).tripIds.add(ref.tripId)
      if (ref.stayId) region(p.a2).stayIds.add(ref.stayId)
      for (const w of who) addSource(ensure(byPerson, w).countries, p.a2, src)
    }
    if (p.state) {
      const code = `US-${p.state}`
      region(code)
      if (ref.tripId) region(code).tripIds.add(ref.tripId)
      if (ref.stayId) region(code).stayIds.add(ref.stayId)
      for (const w of who) addSource(ensure(byPerson, w).states, p.state, src)
    }
  }

  // Trips: resolve endpoints, paint regions, collect arcs + points.
  trips.forEach((t, i) => {
    const a = resolveEndpoint(index, t.from, { lat: t.fromLat, lon: t.fromLon })
    const b = resolveEndpoint(index, t.to, { lat: t.toLat, lon: t.toLon })
    if (a) {
      paint(a, t.who, 'trip', { tripId: t.id })
      addPoint(a, a.kind === 'coord' ? 'coord' : a.kind, t.who, { tripId: t.id })
    }
    if (b) {
      paint(b, t.who, 'trip', { tripId: t.id })
      addPoint(b, b.kind === 'coord' ? 'coord' : b.kind, t.who, { tripId: t.id })
    }
    if (a && b) {
      const arc: TArc = { key: `t${t.id || i}`, type: t.type, personIds: t.who, from: a, to: b, tripId: t.id }
      if (t.date) arc.date = t.date
      arcs.push(arc)
    }
  })

  // Stays: resolve location, paint, drop a pin.
  stays.forEach((s, i) => {
    const p = resolveEndpoint(index, s.place, { lat: s.lat, lon: s.lon })
    if (!p) return
    paint(p, s.who, 'stay', { stayId: s.id })
    addPoint({ ...p, label: s.name || s.place || p.label }, 'stay', s.who, { stayId: s.id || String(i) })
  })

  // Manual places lists (hand-edited txt): paint with 'manual' provenance.
  for (const [pid, tokens] of Object.entries(placesByPerson)) {
    const r = ensure(byPerson, pid)
    for (const tok of tokens) {
      const parsed = parsePlace(tok)
      if (parsed.country) {
        addSource(r.countries, parsed.country, 'manual')
        region(parsed.country)
      }
      if (parsed.state) {
        addSource(r.states, parsed.state, 'manual')
        region(`US-${parsed.state}`)
      }
      if (typeof parsed.lat === 'number' && typeof parsed.lon === 'number') {
        addPoint({ lat: parsed.lat, lon: parsed.lon, label: parsed.label, kind: 'coord' }, 'coord', [pid], {})
      }
    }
  }

  return { byPerson, arcs, points: [...pointMap.values()], regionItems }
}

/** Union the visited countries/states across a set of selected people. */
export function unionRegions(byPerson: Record<string, PersonRegions>, personIds: string[]) {
  const countries = new Set<string>()
  const states = new Set<string>()
  for (const id of personIds) {
    const r = byPerson[id]
    if (!r) continue
    for (const k of r.countries.keys()) countries.add(k)
    for (const k of r.states.keys()) states.add(k)
  }
  return { countries, states }
}
