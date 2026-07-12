// StatsPanel — headline numbers for the current selection, a year sparkline,
// highlights, per-type breakdown, and a per-person table. All from the trip log.

import { useMemo } from 'react'
import { PanelHeader } from '~/components/ui'
import { TripTypeIcon } from '~/components/icons'
import type { TArc } from '~/lib/derive'
import { countryName } from '~/lib/geo'
import { arcsFor, computeStats, tripsFor } from '~/lib/stats'
import type { Person, Trip } from '~/lib/types'

const fmt = (n: number) => Math.round(n).toLocaleString('en-US')

export function StatsPanel({
  people,
  trips,
  arcs,
  selected,
  onClose,
}: {
  people: Person[]
  trips: Trip[]
  arcs: TArc[]
  selected: string[] | null
  onClose: () => void
}) {
  const stats = useMemo(() => computeStats(arcsFor(arcs, selected), tripsFor(trips, selected)), [arcs, trips, selected])
  const perPerson = useMemo(
    () => people.map((p) => ({ p, s: computeStats(arcsFor(arcs, [p.id]), tripsFor(trips, [p.id])) })).sort((a, b) => b.s.distanceKm - a.s.distanceKm),
    [people, arcs, trips],
  )
  const scope = selected && selected.length === 1 ? people.find((p) => p.id === selected[0])?.name ?? 'Person' : 'Everyone'

  return (
    <>
      <PanelHeader title={scope} sub="a lifetime, tallied" onClose={onClose} />
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        <div className="grid grid-cols-2 gap-2">
          <Tile label="Trips" value={fmt(stats.trips)} sub={`${fmt(stats.flights)} flights`} />
          <Tile label="Miles" value={fmt(stats.distanceMi)} sub={`${fmt(stats.distanceKm)} km`} />
          <Tile label="Countries" value={fmt(stats.countries)} />
          <Tile label="Airports" value={fmt(stats.airports)} />
        </div>

        {stats.perYear.length > 1 && (
          <div className="mt-3 rounded-xl border border-line bg-panel px-3 py-2.5">
            <Label>By year</Label>
            <Spark data={stats.perYear} />
          </div>
        )}

        {stats.byType.length > 0 && (
          <div className="mt-3 rounded-xl border border-line bg-panel px-3 py-2.5">
            <Label>How</Label>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {stats.byType.map((b) => (
                <span key={b.type} className="inline-flex items-center gap-1.5 rounded-lg bg-panel-2 px-2 py-1 text-xs font-medium capitalize text-fg2">
                  <TripTypeIcon type={b.type} size={13} /> {b.type} <span className="tnum text-fg3">{b.count}</span>
                </span>
              ))}
            </div>
          </div>
        )}

        {(stats.longest || stats.topRoute || stats.first) && (
          <div className="mt-3 rounded-xl border border-line bg-panel px-3 py-2.5">
            <Label>Highlights</Label>
            <dl className="mt-1.5 space-y-1 text-[13px]">
              {stats.longest && <Row k="Longest" v={`${stats.longest.from} → ${stats.longest.to} · ${fmt(stats.longest.km / 1.609344)} mi`} />}
              {stats.topRoute && <Row k="Most travelled" v={`${stats.topRoute.a} ↔ ${stats.topRoute.b} · ${stats.topRoute.count}×`} />}
              {stats.first?.date && <Row k="First" v={`${stats.first.date} · ${short(stats.first.from)} → ${short(stats.first.to)}`} />}
              {stats.last?.date && <Row k="Latest" v={`${stats.last.date} · ${short(stats.last.from)} → ${short(stats.last.to)}`} />}
            </dl>
          </div>
        )}

        {stats.countryList.length > 0 && (
          <div className="mt-3 rounded-xl border border-line bg-panel px-3 py-2.5">
            <Label>Countries</Label>
            <div className="mt-1.5 flex flex-wrap gap-1">
              {stats.countryList.map((a2) => (
                <span key={a2} className="rounded-md bg-panel-2 px-1.5 py-0.5 text-[11px] text-fg2">
                  {countryName(a2)}
                </span>
              ))}
            </div>
          </div>
        )}

        {perPerson.length > 1 && (
          <div className="mt-3">
            <Label>Per person</Label>
            <div className="mt-1.5 space-y-1">
              {perPerson.map(({ p, s }) => (
                <div key={p.id} className="flex items-center gap-2 rounded-lg bg-panel px-2.5 py-1.5 text-[13px]">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: p.color }} />
                  <span className="flex-1 truncate font-medium">{p.name}</span>
                  <span className="tnum text-fg3">{fmt(s.trips)} trips</span>
                  <span className="tnum w-20 text-right text-fg3">{fmt(s.distanceMi)} mi</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  )
}

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-line bg-panel px-3 py-2.5">
      <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-fg3">{label}</div>
      <div className="mt-0.5 font-serif text-[22px] font-semibold leading-none tracking-tight tnum">{value}</div>
      {sub && <div className="mt-0.5 text-[11px] text-fg3 tnum">{sub}</div>}
    </div>
  )
}
function Label({ children }: { children: React.ReactNode }) {
  return <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-fg3">{children}</div>
}
function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="shrink-0 text-fg3">{k}</dt>
      <dd className="truncate text-right font-medium">{v}</dd>
    </div>
  )
}
function Spark({ data }: { data: { year: number; count: number }[] }) {
  const max = Math.max(...data.map((d) => d.count))
  const w = 100
  const h = 28
  const bw = w / data.length
  return (
    <div className="mt-1.5">
      <svg viewBox={`0 0 ${w} ${h}`} className="h-9 w-full" preserveAspectRatio="none" aria-hidden="true">
        {data.map((d, i) => {
          const bh = max ? (d.count / max) * (h - 3) : 0
          return <rect key={d.year} x={i * bw + 0.6} y={h - bh} width={bw - 1.2} height={bh} rx={1} fill="var(--color-accent)" opacity={0.9} />
        })}
      </svg>
      <div className="flex justify-between text-[10px] text-fg4 tnum">
        <span>{data[0]!.year}</span>
        <span>{data[data.length - 1]!.year}</span>
      </div>
    </div>
  )
}
const short = (s: string) => s.split(',')[0]!.split(' · ')[0]!.trim()
