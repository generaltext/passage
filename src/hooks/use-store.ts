// use-store.ts — the single source of truth for Passage's records. Reads the
// three collections (people, trips, stays) + each person's places txt reactively,
// and exposes CRUD that writes minimal, key-ordered lines back through window.gt.

import { useCallback, useMemo } from 'react'
import { useGtText, useGtTexts } from '~/hooks/use-gt-files'
import { newId, parsePlacesTxt, parseRecords, toJsonl } from '~/lib/jsonl'
import { PATHS, type Person, type Stay, type Trip } from '~/lib/types'

const PERSON_KEYS = ['id', 'name', 'color', 'born']
const TRIP_KEYS = ['type', 'date', 'from', 'to', 'who', 'carrier', 'number', 'note', 'fromLat', 'fromLon', 'toLat', 'toLon', 'id']
const STAY_KEYS = ['place', 'name', 'when', 'start', 'end', 'who', 'lat', 'lon', 'note', 'id']

export interface Store {
  people: Person[]
  trips: Trip[]
  stays: Stay[]
  placesByPerson: Record<string, string[]>
  rawPlaces: Record<string, string>
  personById: (id: string) => Person | undefined
  upsertPerson: (p: Partial<Person> & { name: string; color: string }) => Promise<string>
  removePerson: (id: string) => Promise<void>
  upsertTrip: (t: Partial<Trip> & Pick<Trip, 'type' | 'from' | 'to' | 'who'>) => Promise<void>
  removeTrip: (id: string) => Promise<void>
  upsertStay: (s: Partial<Stay> & Pick<Stay, 'place' | 'who'>) => Promise<void>
  removeStay: (id: string) => Promise<void>
  appendPlaces: (personId: string, tokens: string[]) => Promise<void>
  writePlacesText: (personId: string, text: string) => Promise<void>
}

export function useStore(): Store {
  const gt = window.gt
  const peopleText = useGtText(PATHS.people)
  const tripsText = useGtText(PATHS.trips)
  const staysText = useGtText(PATHS.stays)

  const people = useMemo(() => parseRecords<Person>(peopleText), [peopleText])
  const trips = useMemo(
    () => parseRecords<Trip>(tripsText).map((t) => ({ ...t, who: t.who ?? [], type: t.type ?? 'other' })),
    [tripsText],
  )
  const stays = useMemo(
    () => parseRecords<Stay>(staysText).map((s) => ({ ...s, who: s.who ?? [] })),
    [staysText],
  )

  const placesPaths = useMemo(() => people.map((p) => PATHS.places(p.id)), [people])
  const placesTexts = useGtTexts(placesPaths)
  const placesByPerson = useMemo(() => {
    const out: Record<string, string[]> = {}
    for (const p of people) out[p.id] = parsePlacesTxt(placesTexts[PATHS.places(p.id)] ?? '')
    return out
  }, [people, placesTexts])
  const rawPlaces = useMemo(() => {
    const out: Record<string, string> = {}
    for (const p of people) out[p.id] = placesTexts[PATHS.places(p.id)] ?? ''
    return out
  }, [people, placesTexts])

  const personById = useCallback((id: string) => people.find((p) => p.id === id), [people])

  const writeCollection = useCallback(
    (path: string, rows: object[], keys: string[]) => gt.writeFile(path, toJsonl(rows, keys)),
    [gt],
  )

  const upsertPerson = useCallback<Store['upsertPerson']>(
    async (p) => {
      const id = p.id || slugId(p.name, people)
      const next = { ...p, id }
      const rows = people.some((x) => x.id === id)
        ? people.map((x) => (x.id === id ? { ...x, ...next } : x))
        : [...people, next as Person]
      await writeCollection(PATHS.people, rows, PERSON_KEYS)
      return id
    },
    [people, writeCollection],
  )
  const removePerson = useCallback<Store['removePerson']>(
    async (id) => void (await writeCollection(PATHS.people, people.filter((x) => x.id !== id), PERSON_KEYS)),
    [people, writeCollection],
  )

  const upsertTrip = useCallback<Store['upsertTrip']>(
    async (t) => {
      const id = t.id || newId()
      const next = { ...t, id } as Trip
      const rows = trips.some((x) => x.id === id) ? trips.map((x) => (x.id === id ? next : x)) : [...trips, next]
      await writeCollection(PATHS.trips, rows, TRIP_KEYS)
    },
    [trips, writeCollection],
  )
  const removeTrip = useCallback<Store['removeTrip']>(
    async (id) => void (await writeCollection(PATHS.trips, trips.filter((x) => x.id !== id), TRIP_KEYS)),
    [trips, writeCollection],
  )

  const upsertStay = useCallback<Store['upsertStay']>(
    async (s) => {
      const id = s.id || newId()
      const next = { ...s, id } as Stay
      const rows = stays.some((x) => x.id === id) ? stays.map((x) => (x.id === id ? next : x)) : [...stays, next]
      await writeCollection(PATHS.stays, rows, STAY_KEYS)
    },
    [stays, writeCollection],
  )
  const removeStay = useCallback<Store['removeStay']>(
    async (id) => void (await writeCollection(PATHS.stays, stays.filter((x) => x.id !== id), STAY_KEYS)),
    [stays, writeCollection],
  )

  const appendPlaces = useCallback<Store['appendPlaces']>(
    async (personId, tokens) => {
      const path = PATHS.places(personId)
      const existingText = placesTexts[path] ?? ''
      const have = new Set(parsePlacesTxt(existingText).map((t) => t.toLowerCase()))
      const fresh = tokens.filter((t) => t && !have.has(t.toLowerCase()))
      if (!fresh.length) return
      const base = existingText.replace(/\n*$/, '')
      await gt.writeFile(path, (base ? base + '\n' : '') + fresh.join('\n') + '\n')
    },
    [gt, placesTexts],
  )
  const writePlacesText = useCallback<Store['writePlacesText']>(
    async (personId, text) => {
      const clean = text.replace(/\n*$/, '')
      await gt.writeFile(PATHS.places(personId), clean ? clean + '\n' : '')
    },
    [gt],
  )

  return {
    people,
    trips,
    stays,
    placesByPerson,
    rawPlaces,
    personById,
    upsertPerson,
    removePerson,
    upsertTrip,
    removeTrip,
    upsertStay,
    removeStay,
    appendPlaces,
    writePlacesText,
  }
}

function slugId(name: string, existing: Person[]): string {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'person'
  const taken = new Set(existing.map((p) => p.id))
  if (!taken.has(base)) return base
  for (let i = 2; ; i++) if (!taken.has(`${base}-${i}`)) return `${base}-${i}`
}
