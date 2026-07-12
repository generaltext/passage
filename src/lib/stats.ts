// stats.ts — aggregates over trips, for one person or the whole family. Distance
// and countries come from the resolved arc endpoints; type/flight counts from the
// trip records. Everything computed offline.

import type { TArc } from '~/lib/derive'
import { haversineKm, KM_PER_MILE } from '~/lib/geo'
import type { Trip, TripType } from '~/lib/types'

export interface RouteStat {
  a: string
  b: string
  count: number
}
export interface Stats {
  trips: number
  flights: number
  distanceKm: number
  distanceMi: number
  airports: number
  countries: number
  countryList: string[]
  byType: { type: TripType; count: number }[]
  longest?: { km: number; from: string; to: string; date?: string }
  topRoute?: RouteStat
  first?: Trip
  last?: Trip
  perYear: { year: number; count: number }[]
}

export function tripsFor(trips: Trip[], personIds: string[] | null): Trip[] {
  if (!personIds) return trips
  const set = new Set(personIds)
  return trips.filter((t) => t.who.some((w) => set.has(w)))
}
export function arcsFor(arcs: TArc[], personIds: string[] | null): TArc[] {
  if (!personIds) return arcs
  const set = new Set(personIds)
  return arcs.filter((a) => a.personIds.some((w) => set.has(w)))
}

const arcLabel = (p: { label: string }) => p.label.split(' · ')[0]!.split(',')[0]!.trim()

export function computeStats(arcs: TArc[], trips: Trip[]): Stats {
  let distanceKm = 0
  const countries = new Set<string>()
  const airports = new Set<string>()
  const routes = new Map<string, RouteStat>()
  const perYear = new Map<number, number>()
  const typeCounts = new Map<TripType, number>()
  let longest: Stats['longest']

  for (const arc of arcs) {
    const km = haversineKm(arc.from.lat, arc.from.lon, arc.to.lat, arc.to.lon)
    distanceKm += km
    if (!longest || km > longest.km) {
      longest = { km, from: arcLabel(arc.from), to: arcLabel(arc.to) }
      if (arc.date) longest.date = arc.date
    }
    for (const p of [arc.from, arc.to]) {
      if (p.a2) countries.add(p.a2)
      if (p.kind === 'airport') airports.add(p.label)
    }
    const a = arcLabel(arc.from)
    const b = arcLabel(arc.to)
    const [ra, rb] = a < b ? [a, b] : [b, a]
    const rk = `${ra}|${rb}`
    const r = routes.get(rk) ?? { a: ra, b: rb, count: 0 }
    r.count++
    routes.set(rk, r)
  }

  let first: Trip | undefined
  let last: Trip | undefined
  for (const t of trips) {
    typeCounts.set(t.type, (typeCounts.get(t.type) ?? 0) + 1)
    const year = Number((t.date ?? '').slice(0, 4))
    if (year) perYear.set(year, (perYear.get(year) ?? 0) + 1)
    if (t.date) {
      if (!first || (first.date && t.date < first.date)) first = t
      if (!last || (last.date && t.date > last.date)) last = t
    }
  }

  let topRoute: RouteStat | undefined
  for (const r of routes.values()) if (!topRoute || r.count > topRoute.count) topRoute = r

  return {
    trips: trips.length,
    flights: trips.filter((t) => t.type === 'flight').length,
    distanceKm,
    distanceMi: distanceKm / KM_PER_MILE,
    airports: airports.size,
    countries: countries.size,
    countryList: [...countries].sort(),
    byType: [...typeCounts.entries()].map(([type, count]) => ({ type, count })).sort((x, y) => y.count - x.count),
    longest,
    topRoute: topRoute && topRoute.count > 1 ? topRoute : undefined,
    first,
    last,
    perYear: [...perYear.entries()].map(([year, count]) => ({ year, count })).sort((x, y) => x.year - y.year),
  }
}
