// LogPanel — one dense timeline of trips + stays, newest first, grouped by year.
// Click a row to edit. Respects the person filter.

import { useMemo } from 'react'
import { Hotel, Plane, UserPlus, Pencil } from 'lucide-react'
import { PanelHeader } from '~/components/ui'
import { TripTypeIcon } from '~/components/icons'
import type { GeoIndex } from '~/lib/geo'
import { haversineKm } from '~/lib/geo'
import type { Person, Stay, Trip } from '~/lib/types'
import { resolveEndpoint } from '~/lib/geo'

type Item = { sort: string; year: string } & ({ kind: 'trip'; rec: Trip } | { kind: 'stay'; rec: Stay })

const yearOf = (s?: string) => {
  const m = /\b(\d{4})\b/.exec(s ?? '')
  return m ? m[1]! : ''
}

export function LogPanel({
  people,
  trips,
  stays,
  geo,
  selected,
  onAddTrip,
  onAddStay,
  onAddPerson,
  onFocusTrip,
  onFocusStay,
  onEditTrip,
  onEditStay,
  onClose,
}: {
  people: Person[]
  trips: Trip[]
  stays: Stay[]
  geo: GeoIndex | null
  selected: string[] | null
  onAddTrip: () => void
  onAddStay: () => void
  onAddPerson: () => void
  onFocusTrip: (t: Trip) => void
  onFocusStay: (s: Stay) => void
  onEditTrip: (t: Trip) => void
  onEditStay: (s: Stay) => void
  onClose: () => void
}) {
  const sel = selected ? new Set(selected) : null
  const inSel = (who: string[]) => !sel || who.some((w) => sel.has(w))
  const nameOf = (id: string) => people.find((p) => p.id === id)?.name ?? id
  const colorOf = (id: string) => people.find((p) => p.id === id)?.color ?? 'var(--color-fg3)'

  const groups = useMemo(() => {
    const items: Item[] = []
    for (const t of trips) if (inSel(t.who)) items.push({ kind: 'trip', sort: t.date || '0', year: yearOf(t.date) || '—', rec: t })
    for (const s of stays)
      if (inSel(s.who)) {
        const sort = s.start || (/\d{4}-\d{2}/.test(s.when ?? '') ? s.when! : yearOf(s.when) ? `${yearOf(s.when)}-13` : '0')
        items.push({ kind: 'stay', sort, year: yearOf(s.when) || yearOf(s.start) || '—', rec: s })
      }
    items.sort((a, b) => (a.sort < b.sort ? 1 : a.sort > b.sort ? -1 : 0))
    const byYear = new Map<string, Item[]>()
    for (const it of items) (byYear.get(it.year) ?? byYear.set(it.year, []).get(it.year)!).push(it)
    return [...byYear.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trips, stays, selected])

  const count = trips.filter((t) => inSel(t.who)).length + stays.filter((s) => inSel(s.who)).length

  const Who = ({ who }: { who: string[] }) => (
    <span className="flex items-center gap-1">
      {who.map((id) => (
        <span key={id} className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: colorOf(id) }} title={nameOf(id)} />
      ))}
    </span>
  )

  const hasPeople = people.length > 0

  return (
    <>
      <PanelHeader title="Log" sub={`${count} trips & stays`} onClose={onClose} />
      <div className="grid grid-cols-3 gap-1.5 border-b border-glass-line px-2.5 py-2">
        <AddBtn icon={<Plane size={15} />} label="Trip" onClick={onAddTrip} disabled={!hasPeople} />
        <AddBtn icon={<Hotel size={15} />} label="Stay" onClick={onAddStay} disabled={!hasPeople} />
        <AddBtn icon={<UserPlus size={15} />} label="Person" onClick={onAddPerson} />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-2.5 py-2">
        {!groups.length ? (
          <p className="px-2 py-8 text-center text-sm text-fg3">Nothing logged yet. Use “Add”.</p>
        ) : (
          groups.map(([year, items]) => (
            <section key={year} className="mb-3">
              <h3 className="sticky top-0 z-[1] mb-1 bg-glass px-1.5 py-1 font-serif text-sm font-semibold text-fg2 backdrop-blur">{year}</h3>
              <ul className="space-y-1">
                {items.map((it) =>
                  it.kind === 'trip' ? (
                    <li key={`t${it.rec.id}`}>
                      <TripRow t={it.rec} geo={geo} who={<Who who={it.rec.who} />} onFocus={() => onFocusTrip(it.rec)} onEdit={() => onEditTrip(it.rec)} />
                    </li>
                  ) : (
                    <li key={`s${it.rec.id}`}>
                      <StayRow s={it.rec} who={<Who who={it.rec.who} />} onFocus={() => onFocusStay(it.rec)} onEdit={() => onEditStay(it.rec)} />
                    </li>
                  ),
                )}
              </ul>
            </section>
          ))
        )}
      </div>
    </>
  )
}

function Row({ icon, iconClass, onFocus, onEdit, children, who }: { icon: React.ReactNode; iconClass: string; onFocus: () => void; onEdit: () => void; children: React.ReactNode; who: React.ReactNode }) {
  return (
    <div className="group relative">
      <button type="button" onClick={onFocus} title="Show on the globe" className="flex w-full items-start gap-2.5 rounded-lg px-2 py-1.5 pr-8 text-left hover:bg-accent-tint">
        <span className={`mt-0.5 ${iconClass}`}>{icon}</span>
        <span className="min-w-0 flex-1">{children}</span>
        <span className="mt-0.5 shrink-0 transition-opacity group-hover:opacity-0">{who}</span>
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          onEdit()
        }}
        aria-label="Edit"
        title="Edit"
        className="absolute right-1.5 top-1.5 rounded-md p-1 text-fg3 opacity-0 transition-opacity hover:bg-panel hover:text-accent focus:opacity-100 group-hover:opacity-100"
      >
        <Pencil size={14} />
      </button>
    </div>
  )
}

function TripRow({ t, geo, who, onFocus, onEdit }: { t: Trip; geo: GeoIndex | null; who: React.ReactNode; onFocus: () => void; onEdit: () => void }) {
  const a = geo ? resolveEndpoint(geo, t.from, { lat: t.fromLat, lon: t.fromLon }) : null
  const b = geo ? resolveEndpoint(geo, t.to, { lat: t.toLat, lon: t.toLon }) : null
  const miles = a && b ? Math.round(haversineKm(a.lat, a.lon, b.lat, b.lon) / 1.609344) : null
  return (
    <Row icon={<TripTypeIcon type={t.type} size={15} />} iconClass="text-accent" onFocus={onFocus} onEdit={onEdit} who={who}>
      <span className="flex items-baseline gap-1.5 text-[13px] font-semibold">
        <span className="truncate">{short(t.from)}</span>
        <span className="text-fg4">→</span>
        <span className="truncate">{short(t.to)}</span>
      </span>
      <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-fg3">
        {t.date && <span className="tnum">{t.date}</span>}
        {t.number && <span className="font-mono">{t.number}</span>}
        {miles != null && <span className="tnum">{miles.toLocaleString()} mi</span>}
        {t.carrier && <span>{t.carrier}</span>}
      </span>
    </Row>
  )
}

function StayRow({ s, who, onFocus, onEdit }: { s: Stay; who: React.ReactNode; onFocus: () => void; onEdit: () => void }) {
  return (
    <Row icon={<Hotel size={15} />} iconClass="text-fg2" onFocus={onFocus} onEdit={onEdit} who={who}>
      <span className="block truncate text-[13px] font-semibold">{s.name || s.place}</span>
      <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-fg3">
        {s.name && <span className="truncate">{s.place}</span>}
        {s.when && <span>{s.when}</span>}
      </span>
    </Row>
  )
}

const short = (s: string) => s.split(',')[0]!.trim()

function AddBtn({ icon, label, onClick, disabled }: { icon: React.ReactNode; label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-accent px-2 py-1.5 text-[13px] font-semibold text-accent-fg transition-opacity hover:opacity-90 disabled:opacity-40"
    >
      {icon}
      {label}
    </button>
  )
}
