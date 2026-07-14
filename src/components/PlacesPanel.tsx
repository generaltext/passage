// PlacesPanel — a clean, clickable list of everywhere the current selection has
// been. Click a place to see its trips & stays (opens the inspector) and light
// it up on the globe. Respects the top-bar person filter, like the map and
// stats. (Manual additions still come from places/<person>.txt — edited in a
// text editor, not surfaced here.)

import { useMemo } from 'react'
import { ChevronRight } from 'lucide-react'
import { PanelHeader } from '~/components/ui'
import type { DerivedGeo } from '~/lib/derive'
import type { MapPick } from '~/components/WorldMap'
import { countryName, stateName } from '~/lib/geo'
import type { Person } from '~/lib/types'

interface Place {
  code: string
  name: string
  count: number
}

export function PlacesPanel({
  people,
  derived,
  selected,
  onPick,
  onClose,
}: {
  people: Person[]
  derived: DerivedGeo | null
  selected: string[] | null
  onPick: (pick: MapPick) => void
  onClose: () => void
}) {
  const { countries, states } = useMemo(() => {
    const cs: Place[] = []
    const ss: Place[] = []
    if (derived) {
      const ids = selected ?? people.map((p) => p.id)
      const seenC = new Set<string>()
      const seenS = new Set<string>()
      const count = (code: string) => {
        const r = derived.regionItems.get(code)
        return r ? r.tripIds.size + r.stayIds.size : 0
      }
      for (const id of ids) {
        const r = derived.byPerson[id]
        if (!r) continue
        for (const a2 of r.countries.keys()) if (!seenC.has(a2)) { seenC.add(a2); cs.push({ code: a2, name: countryName(a2), count: count(a2) }) }
        for (const st of r.states.keys()) if (!seenS.has(st)) { seenS.add(st); ss.push({ code: `US-${st}`, name: stateName(st), count: count(`US-${st}`) }) }
      }
    }
    cs.sort((a, b) => a.name.localeCompare(b.name))
    ss.sort((a, b) => a.name.localeCompare(b.name))
    return { countries: cs, states: ss }
  }, [derived, selected, people])

  const total = countries.length + states.length
  const sub = total ? `${countries.length} ${countries.length === 1 ? 'country' : 'countries'}${states.length ? ` · ${states.length} US ${states.length === 1 ? 'state' : 'states'}` : ''}` : 'nowhere yet'

  return (
    <>
      <PanelHeader title="Places" sub={sub} onClose={onClose} />
      <div className="min-h-0 flex-1 overflow-y-auto p-2.5">
        {total === 0 ? (
          <p className="px-2 py-8 text-center text-sm text-fg3">Log a trip or a stay and the places you've been show up here.</p>
        ) : (
          <>
            <Section label="Countries" places={countries} onPick={onPick} />
            {states.length > 0 && <Section label="US states" places={states} onPick={onPick} />}
          </>
        )}
      </div>
    </>
  )
}

function Section({ label, places, onPick }: { label: string; places: Place[]; onPick: (p: MapPick) => void }) {
  return (
    <section className="mb-3">
      <div className="px-1.5 pb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-fg3">{label}</div>
      <ul>
        {places.map((pl) => (
          <li key={pl.code}>
            <button
              type="button"
              onClick={() => onPick({ kind: 'region', code: pl.code })}
              className="group flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-accent-tint"
            >
              <span className="flex-1 truncate text-[13px] font-medium">{pl.name}</span>
              {pl.count > 0 && <span className="tnum text-[11px] text-fg3">{pl.count}</span>}
              <ChevronRight size={13} className="shrink-0 text-fg4 transition-colors group-hover:text-accent" />
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
