// features.ts — country + US-state GeoJSON features decorated with our region
// codes, shared by the 3D globe (WorldMap) and the flat poster renderer so both
// draw from one source. 10m Natural Earth (simplified) + us-atlas states.

import { feature } from 'topojson-client'
import world10m from '~/data/world-10m.json'
import usStates10m from '~/data/us-states-10m.json'
import { stateFips } from '~/lib/geo'

/* eslint-disable @typescript-eslint/no-explicit-any */
const world = world10m as any
const us = usStates10m as any

export interface RegionFeature {
  type: 'Feature'
  properties: { __kind: 'country' | 'state'; __a2?: string; __postal?: string; __code: string; __name: string; [k: string]: unknown }
  geometry: unknown
}

export const COUNTRY_FEATS: RegionFeature[] = ((feature(world, world.objects.countries) as any).features as any[]).map((f) => {
  const a2 = f.properties?.a2 || ''
  f.properties = f.properties || {}
  f.properties.__kind = 'country'
  f.properties.__a2 = a2
  f.properties.__code = a2
  f.properties.__name = f.properties.name ?? ''
  return f
})

const FIPS_TO_POSTAL = new Map<string, string>()
for (const p of ['AL','AK','AZ','AR','CA','CO','CT','DE','DC','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY']) {
  const f = stateFips(p)
  if (f) FIPS_TO_POSTAL.set(f, p)
}

export const STATE_FEATS: RegionFeature[] = ((feature(us, us.objects.states) as any).features as any[]).map((f) => {
  const fips = String(f.id).padStart(2, '0')
  const postal = FIPS_TO_POSTAL.get(fips) ?? ''
  f.properties = f.properties || {}
  f.properties.__kind = 'state'
  f.properties.__postal = postal
  f.properties.__code = postal ? `US-${postal}` : ''
  f.properties.__name = f.properties.name ?? ''
  return f
})
/* eslint-enable @typescript-eslint/no-explicit-any */

export const COUNTRY_NO_US: RegionFeature[] = COUNTRY_FEATS.filter((f) => f.properties.__a2 !== 'US')
export const COUNTRY_PLUS_STATES: RegionFeature[] = [...COUNTRY_NO_US, ...STATE_FEATS]

// A single a2/postal can map to MANY features (mainland + islands + overseas
// territories), so index to arrays — otherwise scattered countries like BR or FR
// only surface one tiny sliver.
function groupBy(feats: RegionFeature[], key: (f: RegionFeature) => string): Map<string, RegionFeature[]> {
  const m = new Map<string, RegionFeature[]>()
  for (const f of feats) {
    const k = key(f)
    if (!k) continue
    const a = m.get(k)
    if (a) a.push(f)
    else m.set(k, [f])
  }
  return m
}
const countriesByA2 = groupBy(COUNTRY_FEATS, (f) => f.properties.__a2 ?? '')
const statesByPostal = groupBy(STATE_FEATS, (f) => f.properties.__postal ?? '')

/** All polygons for a region code ("BR", "US-VT", …) — mainland plus territories. */
export function featuresForCode(code: string): RegionFeature[] {
  return code.startsWith('US-') ? statesByPostal.get(code.slice(3)) ?? [] : countriesByA2.get(code) ?? []
}
