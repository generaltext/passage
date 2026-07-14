// InspectorPanel — right-docked. Clicking a country, state, or point on the map
// opens this: what trips and stays touch that place.

import { useMemo } from 'react'
import { Hotel } from 'lucide-react'
import { PanelHeader } from '~/components/ui'
import { TripTypeIcon } from '~/components/icons'
import type { MapPick } from '~/components/WorldMap'
import type { DerivedGeo } from '~/lib/derive'
import { countryName, stateName } from '~/lib/geo'
import type { Person, Stay, Trip } from '~/lib/types'

export function InspectorPanel({
  pick,
  derived,
  people,
  trips,
  stays,
  onEditTrip,
  onEditStay,
  onClose,
}: {
  pick: MapPick
  derived: DerivedGeo
  people: Person[]
  trips: Trip[]
  stays: Stay[]
  onEditTrip: (t: Trip) => void
  onEditStay: (s: Stay) => void
  onClose: () => void
}) {
  const { title, tripList, stayList } = useMemo(() => {
    let tripIds = new Set<string>()
    let stayIds = new Set<string>()
    let title = 'Place'
    if (pick.kind === 'region') {
      const code = pick.code
      title = code.startsWith('US-') ? stateName(code.slice(3)) : countryName(code)
      const items = derived.regionItems.get(code)
      if (items) {
        tripIds = items.tripIds
        stayIds = items.stayIds
      }
    } else {
      title = pick.point.label
      tripIds = new Set(pick.point.tripIds)
      stayIds = new Set(pick.point.stayIds)
    }
    const tripList = trips.filter((t) => tripIds.has(t.id))
    const stayList = stays.filter((s) => stayIds.has(s.id))
    return { title, tripList, stayList }
  }, [pick, derived, trips, stays])

  const colorOf = (id: string) => people.find((p) => p.id === id)?.color ?? 'var(--color-fg3)'
  const Who = ({ who }: { who: string[] }) => (
    <span className="flex items-center gap-1">
      {who.map((id) => (
        <span key={id} className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: colorOf(id) }} />
      ))}
    </span>
  )
  const total = tripList.length + stayList.length

  return (
    <aside className="glass panel-shadow absolute bottom-3 right-3 top-[92px] z-[6] flex w-[min(340px,calc(100%-1.5rem))] flex-col overflow-hidden rounded-xl sm:top-[104px]">
      <PanelHeader title={title} sub={total ? `${total} here` : 'nothing logged here yet'} onClose={onClose} />
      <div className="min-h-0 flex-1 overflow-y-auto p-2.5">
        {total === 0 && <p className="px-2 py-6 text-center text-sm text-fg3">Painted from your places list — no trip or stay recorded here.</p>}
        {tripList.length > 0 && (
          <>
            <SecLabel>Trips</SecLabel>
            <ul className="mb-2 space-y-1">
              {tripList.map((t) => (
                <li key={t.id}>
                  <button type="button" onClick={() => onEditTrip(t)} className="flex w-full items-start gap-2.5 rounded-md px-2 py-1.5 text-left hover:bg-accent-tint">
                    <span className="mt-0.5 text-accent">
                      <TripTypeIcon type={t.type} size={15} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-semibold">
                        {short(t.from)} → {short(t.to)}
                      </span>
                      {t.date && <span className="text-[11px] text-fg3 tnum">{t.date}</span>}
                    </span>
                    <span className="mt-0.5">
                      <Who who={t.who} />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
        {stayList.length > 0 && (
          <>
            <SecLabel>Stays</SecLabel>
            <ul className="space-y-1">
              {stayList.map((s) => (
                <li key={s.id}>
                  <button type="button" onClick={() => onEditStay(s)} className="flex w-full items-start gap-2.5 rounded-md px-2 py-1.5 text-left hover:bg-accent-tint">
                    <span className="mt-0.5 text-fg2">
                      <Hotel size={15} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-semibold">{s.name || s.place}</span>
                      {s.when && <span className="text-[11px] text-fg3">{s.when}</span>}
                    </span>
                    <span className="mt-0.5">
                      <Who who={s.who} />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </aside>
  )
}

function SecLabel({ children }: { children: React.ReactNode }) {
  return <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-fg3">{children}</div>
}
const short = (s: string) => s.split(',')[0]!.split(' · ')[0]!.trim()
