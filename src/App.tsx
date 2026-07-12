import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { UserPlus, Info, Moon, Sun, List, BarChart3, Globe2, Plane } from 'lucide-react'
import { PassageMark } from '~/components/PassageMark'
import type { MapPick } from '~/components/WorldMap'

// The globe pulls in three.js — lazy-load it so the shell + panels paint first
// and three lands in its own chunk.
const WorldMap = lazy(() => import('~/components/WorldMap').then((m) => ({ default: m.WorldMap })))
import { TripDialog, StayDialog, PersonDialog } from '~/components/dialogs'
import { LogPanel } from '~/components/LogPanel'
import { StatsPanel } from '~/components/StatsPanel'
import { PlacesPanel } from '~/components/PlacesPanel'
import { InspectorPanel } from '~/components/InspectorPanel'
import { FormatPanel } from '~/components/FormatPanel'
import { useStore } from '~/hooks/use-store'
import { useGeo } from '~/hooks/use-geo'
import { useTheme } from '~/hooks/use-theme'
import { deriveGeo, unionRegions } from '~/lib/derive'
import { resolveEndpoint, haversineKm, type PlacePoint } from '~/lib/geo'
import { seedDemo } from '~/lib/dev-seed'
import type { Person, Stay, Trip } from '~/lib/types'

type PanelId = 'log' | 'stats' | 'places'
const PANELS: { id: PanelId; label: string; icon: React.ReactNode }[] = [
  { id: 'log', label: 'Log', icon: <List size={15} /> },
  { id: 'places', label: 'Places', icon: <Globe2 size={15} /> },
  { id: 'stats', label: 'Stats', icon: <BarChart3 size={15} /> },
]

let seedStarted = false

export default function App() {
  const store = useStore()
  const geo = useGeo()
  const theme = useTheme()
  const { people, trips, stays } = store

  const [panel, setPanel] = useState<PanelId | null>('log')
  const [filter, setFilter] = useState<Set<string> | null>(null)
  const [pick, setPick] = useState<MapPick | null>(null)
  const [tripDlg, setTripDlg] = useState<{ edit?: Trip } | null>(null)
  const [stayDlg, setStayDlg] = useState<{ edit?: Stay } | null>(null)
  const [personDlg, setPersonDlg] = useState<{ edit?: Person } | null>(null)
  const [formatOpen, setFormatOpen] = useState(false)
  const [resetKey, setResetKey] = useState(0)
  const [focus, setFocus] = useState<{ lat: number; lng: number; altitude: number; n: number } | null>(null)
  const focusN = useRef(0)

  useEffect(() => {
    if (seedStarted) return
    seedStarted = true
    ;(async () => {
      await window.gt.ready
      if (window.gt.mode === 'demo') {
        const files = await window.gt.listFiles()
        if (!files.length) await seedDemo()
      }
    })()
  }, [])

  const selected = useMemo(() => (filter && filter.size ? [...filter] : null), [filter])
  const selIds = useMemo(() => selected ?? people.map((p) => p.id), [selected, people])
  const singlePerson = selected?.length === 1 ? people.find((p) => p.id === selected[0]) : undefined

  // concrete hex (the WebGL globe can't read CSS vars)
  const accentHex = theme.dark ? '#7c86ff' : '#5b6cff'
  const colorMap = useMemo(() => new Map(people.map((p) => [p.id, p.color])), [people])
  const colorOf = useMemo(() => (id: string) => colorMap.get(id) ?? accentHex, [colorMap, accentHex])
  const paintRegion = singlePerson?.color ?? accentHex

  const derived = useMemo(() => (geo ? deriveGeo(people, trips, stays, store.placesByPerson, geo) : null), [geo, people, trips, stays, store.placesByPerson])

  const mapView = useMemo(() => {
    if (!derived) return null
    const set = new Set(selIds)
    return {
      arcs: derived.arcs.filter((a) => a.personIds.some((p) => set.has(p))),
      points: derived.points.filter((p) => p.personIds.some((id) => set.has(id))),
      ...unionRegions(derived.byPerson, selIds),
    }
  }, [derived, selIds])

  const toggleFilter = (id: string) =>
    setFilter((prev) => {
      if (!prev) return new Set([id])
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next.size ? next : null
    })

  const goTo = (lat: number, lng: number, altitude: number) => {
    focusN.current += 1
    setFocus({ lat, lng, altitude, n: focusN.current })
  }
  const focusTrip = (t: Trip) => {
    if (!geo) return
    const a = resolveEndpoint(geo, t.from, { lat: t.fromLat, lon: t.fromLon })
    const b = resolveEndpoint(geo, t.to, { lat: t.toLat, lon: t.toLon })
    if (a && b) {
      const m = midpoint(a, b)
      const d = haversineKm(a.lat, a.lon, b.lat, b.lon) / 6371 // radians
      goTo(m.lat, m.lng, clamp(0.35 + d * 0.85, 0.5, 2.3))
    } else if (a || b) {
      const p = (a || b)!
      goTo(p.lat, p.lon, 0.85)
    }
  }
  const focusStay = (s: Stay) => {
    if (!geo) return
    const p = resolveEndpoint(geo, s.place, { lat: s.lat, lon: s.lon })
    if (p) goTo(p.lat, p.lon, 0.8)
  }

  const empty = people.length === 0 && trips.length === 0 && stays.length === 0

  return (
    <div className="relative h-full w-full overflow-hidden">
      {/* MAP — the persistent hero */}
      {mapView ? (
        <Suspense fallback={<div className="absolute inset-0" style={{ background: 'var(--color-space)' }} />}>
          <WorldMap
            arcs={mapView.arcs}
            points={mapView.points}
            visitedCountries={mapView.countries}
            visitedStates={mapView.states}
            paintRegion={paintRegion}
            colorOf={colorOf}
            onPick={setPick}
            highlightCode={pick?.kind === 'region' ? pick.code : null}
            resetKey={resetKey}
            focus={focus}
          />
        </Suspense>
      ) : (
        <div className="absolute inset-0" style={{ background: 'var(--color-space)' }} />
      )}

      {/* TOP-LEFT: brand + panel tabs + person filter */}
      <div className="pointer-events-none absolute left-3 top-3 flex max-w-[calc(100%-1.5rem)] flex-col gap-2">
        <div className="glass panel-shadow pointer-events-auto flex items-center gap-1 rounded-xl p-1">
          <span className="flex items-center gap-1.5 pl-2 pr-1 text-accent">
            <PassageMark size={18} />
            <span className="font-serif text-[15px] font-semibold tracking-tight text-fg">Passage</span>
          </span>
          {window.gt.mode === 'demo' && <span className="rounded-md bg-accent-tint px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-accent">Demo</span>}
          <span className="mx-1 h-5 w-px bg-glass-line" />
          {PANELS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPanel((cur) => (cur === p.id ? null : p.id))}
              aria-pressed={panel === p.id}
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[13px] font-medium transition-colors ${
                panel === p.id ? 'bg-accent text-accent-fg' : 'text-fg2 hover:bg-accent-tint hover:text-accent'
              }`}
            >
              {p.icon}
              <span className="max-sm:hidden">{p.label}</span>
            </button>
          ))}
        </div>

        {people.length > 1 && (
          <div className="glass panel-shadow pointer-events-auto flex flex-wrap items-center gap-1 rounded-xl p-1">
            <button
              type="button"
              onClick={() => setFilter(null)}
              className={`rounded-lg px-2 py-1 text-[12px] font-semibold ${!filter ? 'bg-fg text-bg' : 'text-fg3 hover:text-fg2'}`}
            >
              Everyone
            </button>
            {people.map((p) => {
              const on = filter?.has(p.id) ?? false
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => toggleFilter(p.id)}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[12px] font-semibold transition-colors ${on ? 'text-white' : 'text-fg3 hover:text-fg2'}`}
                  style={on ? { backgroundColor: p.color } : undefined}
                >
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: on ? 'rgba(255,255,255,.9)' : p.color }} />
                  {p.name}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* TOP-RIGHT: info + theme */}
      <div className="absolute right-3 top-3 flex items-center gap-2">
        <div className="glass panel-shadow flex items-center rounded-xl p-1">
          <IconBtn label="Files & format" onClick={() => setFormatOpen(true)}>
            <Info size={17} />
          </IconBtn>
          {theme.canToggle && (
            <IconBtn label="Toggle theme" onClick={theme.toggle}>
              {theme.dark ? <Sun size={17} /> : <Moon size={17} />}
            </IconBtn>
          )}
        </div>
      </div>

      {/* LEFT PANEL */}
      {panel && !empty && (
        <aside className="glass panel-shadow absolute bottom-3 left-3 top-[92px] z-[5] flex w-[min(380px,calc(100%-1.5rem))] flex-col overflow-hidden rounded-2xl sm:top-[104px]">
          {panel === 'log' && (
            <LogPanel
              people={people}
              trips={trips}
              stays={stays}
              geo={geo}
              selected={selected}
              onAddTrip={() => setTripDlg({})}
              onAddStay={() => setStayDlg({})}
              onAddPerson={() => setPersonDlg({})}
              onFocusTrip={focusTrip}
              onFocusStay={focusStay}
              onEditTrip={(t) => setTripDlg({ edit: t })}
              onEditStay={(s) => setStayDlg({ edit: s })}
              onClose={() => setPanel(null)}
            />
          )}
          {panel === 'stats' && derived && <StatsPanel people={people} trips={trips} arcs={derived.arcs} selected={selected} onClose={() => setPanel(null)} />}
          {panel === 'places' && (
            <PlacesPanel
              people={people}
              derived={derived}
              rawPlaces={store.rawPlaces}
              selectedPerson={singlePerson?.id}
              appendPlaces={store.appendPlaces}
              writePlacesText={store.writePlacesText}
              onClose={() => setPanel(null)}
            />
          )}
        </aside>
      )}

      {/* RIGHT INSPECTOR */}
      {pick && derived && (
        <InspectorPanel
          pick={pick}
          derived={derived}
          people={people}
          trips={trips}
          stays={stays}
          onEditTrip={(t) => setTripDlg({ edit: t })}
          onEditStay={(s) => setStayDlg({ edit: s })}
          onClose={() => setPick(null)}
        />
      )}

      {empty && <Onboarding onAddPerson={() => setPersonDlg({})} onAddTrip={() => setTripDlg({})} hasPeople={people.length > 0} />}

      {/* focus reset when switching to a single person */}
      <FocusOnSingle single={singlePerson?.id} onFocus={() => setResetKey((k) => k + 1)} />

      {/* DIALOGS */}
      {tripDlg && (
        <TripDialog
          open
          onClose={() => setTripDlg(null)}
          people={people}
          geo={geo}
          {...(tripDlg.edit ? { initial: tripDlg.edit } : {})}
          onSave={(t) => {
            store.upsertTrip(t)
            setTripDlg(null)
          }}
          {...(tripDlg.edit ? { onDelete: () => { store.removeTrip(tripDlg.edit!.id); setTripDlg(null) } } : {})}
        />
      )}
      {stayDlg && (
        <StayDialog
          open
          onClose={() => setStayDlg(null)}
          people={people}
          geo={geo}
          {...(stayDlg.edit ? { initial: stayDlg.edit } : {})}
          onSave={(s) => {
            store.upsertStay(s)
            setStayDlg(null)
          }}
          {...(stayDlg.edit ? { onDelete: () => { store.removeStay(stayDlg.edit!.id); setStayDlg(null) } } : {})}
        />
      )}
      {personDlg && (
        <PersonDialog
          open
          onClose={() => setPersonDlg(null)}
          {...(personDlg.edit ? { initial: personDlg.edit } : {})}
          onSave={(p) => {
            store.upsertPerson(p)
            setPersonDlg(null)
          }}
          {...(personDlg.edit ? { onDelete: () => { store.removePerson(personDlg.edit!.id); setPersonDlg(null) } } : {})}
        />
      )}
      <FormatPanel open={formatOpen} onClose={() => setFormatOpen(false)} people={people} trips={trips} stays={stays} placesByPerson={store.placesByPerson} geo={geo} />
    </div>
  )
}

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v)

/** Great-circle midpoint of two lat/lng points. */
function midpoint(a: PlacePoint, b: PlacePoint): { lat: number; lng: number } {
  const d = Math.PI / 180
  const la1 = a.lat * d
  const lo1 = a.lon * d
  const la2 = b.lat * d
  const lo2 = b.lon * d
  const x = Math.cos(la1) * Math.cos(lo1) + Math.cos(la2) * Math.cos(lo2)
  const y = Math.cos(la1) * Math.sin(lo1) + Math.cos(la2) * Math.sin(lo2)
  const z = Math.sin(la1) + Math.sin(la2)
  const lng = Math.atan2(y, x)
  const lat = Math.atan2(z, Math.hypot(x, y))
  return { lat: lat / d, lng: lng / d }
}

function FocusOnSingle({ single, onFocus }: { single?: string; onFocus: () => void }) {
  const prev = useRef<string | undefined>(undefined)
  useEffect(() => {
    if (single && single !== prev.current) onFocus()
    prev.current = single
  }, [single, onFocus])
  return null
}

function IconBtn({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick} className="rounded-lg p-1.5 text-fg3 hover:bg-accent-tint hover:text-accent">
      {children}
    </button>
  )
}

function Onboarding({ onAddPerson, onAddTrip, hasPeople }: { onAddPerson: () => void; onAddTrip: () => void; hasPeople: boolean }) {
  return (
    <div className="pointer-events-none absolute inset-0 grid place-items-center p-6">
      <div className="glass panel-shadow pointer-events-auto max-w-sm rounded-2xl p-7 text-center">
        <span className="text-accent">
          <PassageMark size={40} />
        </span>
        <h2 className="mt-3 font-serif text-2xl font-semibold">Start your Passage</h2>
        <p className="mt-2 text-sm leading-relaxed text-fg3">
          A lifelong, private record of everywhere you and your people have been. Add the travellers, then log a trip or a
          stay — the map paints itself.
        </p>
        <div className="mt-5 flex justify-center gap-2">
          <button type="button" onClick={onAddPerson} className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3.5 py-2 text-sm font-semibold text-accent-fg hover:opacity-90">
            <UserPlus size={16} /> Add a person
          </button>
          {hasPeople && (
            <button type="button" onClick={onAddTrip} className="inline-flex items-center gap-1.5 rounded-lg border border-line2 px-3.5 py-2 text-sm font-medium text-fg2 hover:bg-panel-2">
              <Plane size={16} /> Add a trip
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
