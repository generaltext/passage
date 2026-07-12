// The Passage record types (v2). Three models: people, the trips they take, and
// the places they stay. The on-disk shape IS the product, so keep them small,
// documented, and stable.

/** A person who travels. Every record and map layer keys off `id`. */
export interface Person {
  id: string
  name: string
  /** #rrggbb — map fills require hex (hsl()/named are rejected by some APIs). */
  color: string
  /** optional ISO birth date, unlocks "log from birth" framing. */
  born?: string
}

export const TRIP_TYPES = ['flight', 'train', 'drive', 'ferry', 'bus', 'other'] as const
export type TripType = (typeof TRIP_TYPES)[number]

/** A movement from one place to another, of a given kind. Endpoints resolve to
 *  coordinates offline: IATA airport codes for flights, city names for the rest
 *  (via the bundled gazetteer), an `@lat,lon` token, or explicit coord fields. */
export interface Trip {
  id: string
  type: TripType
  date?: string // ISO YYYY-MM-DD (partial like "2019" tolerated)
  from: string // IATA (flight) or place name / @lat,lon
  to: string
  who: string[]
  /** airline / rail operator / ferry line — labelled per type in the UI. */
  carrier?: string
  /** flight or train number. */
  number?: string
  note?: string
  /** explicit endpoint coords, when a name doesn't resolve. */
  fromLat?: number
  fromLon?: number
  toLat?: number
  toLon?: number
}

/** Somewhere you stayed: a place, optional lodging name, dates (fuzzy ok), who. */
export interface Stay {
  id: string
  place: string // name; resolved to coordinates
  name?: string // lodging name: hotel, friend's house
  lat?: number
  lon?: number
  start?: string // ISO
  end?: string // ISO
  when?: string // fuzzy period: "summer 2019"
  who: string[]
  note?: string
}

/** Icon/label metadata for trip types (kept here so UI + map agree). */
export const TRIP_META: Record<TripType, { label: string; carrierLabel: string; codeInput: boolean }> = {
  flight: { label: 'Flight', carrierLabel: 'Airline', codeInput: true },
  train: { label: 'Train', carrierLabel: 'Line / operator', codeInput: false },
  drive: { label: 'Drive', carrierLabel: '', codeInput: false },
  ferry: { label: 'Ferry', carrierLabel: 'Operator', codeInput: false },
  bus: { label: 'Bus', carrierLabel: 'Operator', codeInput: false },
  other: { label: 'Other', carrierLabel: '', codeInput: false },
}

/** Where each collection lives, relative to the app's own data folder. */
export const PATHS = {
  people: 'v1/people.jsonl',
  trips: 'v1/trips.jsonl',
  stays: 'v1/stays.jsonl',
  places: (personId: string) => `v1/places/${personId}.txt`,
} as const

/** A curated, high-contrast palette for new people (hex, map-safe). */
export const PERSON_COLORS = [
  '#5b6cff', // electric indigo
  '#ff5a4d', // coral red
  '#22c07a', // emerald
  '#f5a623', // amber
  '#c56bff', // violet
  '#12b5c9', // cyan
  '#ff5da2', // pink
  '#9bcf3b', // lime
] as const
