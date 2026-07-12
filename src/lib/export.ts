// export.ts — take your data elsewhere. The workspace files are already the
// canonical export (plain JSONL you own); these are conveniences: flat CSVs and
// a single combined JSON.

import type { Stay, Trip } from '~/lib/types'
import { type GeoIndex, countryName, haversineKm, resolveEndpoint } from '~/lib/geo'
import type { Person } from '~/lib/types'

export function download(filename: string, text: string, mime = 'text/plain'): void {
  const blob = new Blob([text], { type: `${mime};charset=utf-8` })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function csv(rows: (string | number)[][]): string {
  const esc = (v: string | number) => {
    const s = String(v ?? '')
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return rows.map((r) => r.map(esc).join(',')).join('\n') + '\n'
}

export function tripsCsv(trips: Trip[], geo: GeoIndex | null, people: Person[]): string {
  const name = (id: string) => people.find((p) => p.id === id)?.name ?? id
  const header = ['date', 'type', 'from', 'to', 'from_country', 'to_country', 'miles', 'carrier', 'number', 'who', 'note']
  const rows: (string | number)[][] = [header]
  for (const t of [...trips].sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''))) {
    const a = geo ? resolveEndpoint(geo, t.from, { lat: t.fromLat, lon: t.fromLon }) : null
    const b = geo ? resolveEndpoint(geo, t.to, { lat: t.toLat, lon: t.toLon }) : null
    const miles = a && b ? Math.round(haversineKm(a.lat, a.lon, b.lat, b.lon) / 1.609344) : ''
    rows.push([
      t.date ?? '',
      t.type,
      t.from,
      t.to,
      a?.a2 ? countryName(a.a2) : '',
      b?.a2 ? countryName(b.a2) : '',
      miles,
      t.carrier ?? '',
      t.number ?? '',
      t.who.map(name).join(' + '),
      t.note ?? '',
    ])
  }
  return csv(rows)
}

export function staysCsv(stays: Stay[], people: Person[]): string {
  const name = (id: string) => people.find((p) => p.id === id)?.name ?? id
  const header = ['place', 'lodging', 'when', 'start', 'end', 'lat', 'lon', 'who', 'note']
  const rows: (string | number)[][] = [header]
  for (const s of stays) {
    rows.push([s.place, s.name ?? '', s.when ?? '', s.start ?? '', s.end ?? '', s.lat ?? '', s.lon ?? '', s.who.map(name).join(' + '), s.note ?? ''])
  }
  return csv(rows)
}

export function everythingJson(people: Person[], trips: Trip[], stays: Stay[], placesByPerson: Record<string, string[]>): string {
  return JSON.stringify({ people, trips, stays, places: placesByPerson }, null, 2)
}
