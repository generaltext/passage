// PlacesPanel — the been-list per person, with provenance (trip / stay / by
// hand), suggestions to paint in everywhere the log implies, and a raw editor
// over the hand-authored places/<person>.txt (never rewritten silently).

import { useMemo, useRef, useState } from 'react'
import { Plus, Sparkles, FileText } from 'lucide-react'
import { Button, PanelHeader } from '~/components/ui'
import type { DerivedGeo, RegionSource } from '~/lib/derive'
import { countryName, stateName } from '~/lib/geo'
import type { Person } from '~/lib/types'

interface Row {
  code: string
  name: string
  sources: Set<RegionSource>
}
const SRC: Record<RegionSource, string> = { trip: 'trips', stay: 'stays', manual: 'hand' }

export function PlacesPanel({
  people,
  derived,
  rawPlaces,
  selectedPerson,
  appendPlaces,
  writePlacesText,
  onClose,
}: {
  people: Person[]
  derived: DerivedGeo | null
  rawPlaces: Record<string, string>
  selectedPerson?: string
  appendPlaces: (personId: string, tokens: string[]) => void
  writePlacesText: (personId: string, text: string) => void
  onClose: () => void
}) {
  const [activeId, setActiveId] = useState(selectedPerson ?? people[0]?.id ?? '')
  const active = people.find((p) => p.id === activeId) ?? people[0]

  const rows: Row[] = useMemo(() => {
    if (!derived || !active) return []
    const r = derived.byPerson[active.id]
    if (!r) return []
    const out: Row[] = []
    for (const [a2, sources] of r.countries) out.push({ code: a2, name: countryName(a2), sources })
    for (const [postal, sources] of r.states) out.push({ code: `US-${postal}`, name: stateName(postal), sources })
    return out.sort((a, b) => a.name.localeCompare(b.name))
  }, [derived, active])

  if (!active) return (
    <>
      <PanelHeader title="Places" onClose={onClose} />
      <p className="p-6 text-center text-sm text-fg3">Add a person to start a places list.</p>
    </>
  )

  const suggestions = rows.filter((r) => !r.sources.has('manual'))
  const countries = rows.filter((r) => !r.code.startsWith('US-'))
  const states = rows.filter((r) => r.code.startsWith('US-'))

  return (
    <>
      <PanelHeader title="Places" sub={`${active.name}: ${countries.length} countries${states.length ? ` · ${states.length} states` : ''}`} onClose={onClose} />
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {people.length > 1 && (
          <div className="mb-3 flex flex-wrap gap-1">
            {people.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setActiveId(p.id)}
                className={`inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[12px] font-semibold ${p.id === active.id ? 'text-white' : 'text-fg3 hover:text-fg2'}`}
                style={p.id === active.id ? { backgroundColor: p.color } : undefined}
              >
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: p.id === active.id ? 'rgba(255,255,255,.9)' : p.color }} />
                {p.name}
              </button>
            ))}
          </div>
        )}

        {suggestions.length > 0 && (
          <div className="mb-3 rounded-xl border border-accent/30 bg-accent-tint px-3 py-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-accent">
                <Sparkles size={12} /> From {active.name}'s log
              </span>
              <Button variant="primary" className="!px-2 !py-1 !text-xs" onClick={() => appendPlaces(active.id, suggestions.map((s) => s.code))}>
                Add all {suggestions.length}
              </Button>
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              {suggestions.map((s) => (
                <button
                  key={s.code}
                  type="button"
                  onClick={() => appendPlaces(active.id, [s.code])}
                  className="inline-flex items-center gap-1 rounded-md border border-line2 bg-panel px-2 py-0.5 text-[12px] font-medium text-fg2 hover:border-accent hover:text-accent"
                >
                  <Plus size={11} />
                  {s.name}
                </button>
              ))}
            </div>
          </div>
        )}

        <Group title="Countries" rows={countries} empty="No countries yet." />
        {states.length > 0 && <Group title="US states" rows={states} />}

        <RawEditor key={active.id} personId={active.id} raw={rawPlaces[active.id] ?? ''} onSave={writePlacesText} />
      </div>
    </>
  )
}

function Group({ title, rows, empty }: { title: string; rows: Row[]; empty?: string }) {
  return (
    <div className="mb-3">
      <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-fg3">{title}</div>
      {rows.length === 0 ? (
        <p className="text-[13px] text-fg4">{empty}</p>
      ) : (
        <ul className="flex flex-wrap gap-1">
          {rows.map((r) => (
            <li key={r.code} className="inline-flex items-center gap-1 rounded-md border border-line bg-panel px-1.5 py-0.5 text-[12px]" title={[...r.sources].map((s) => SRC[s]).join(', ')}>
              {r.name}
              {!r.sources.has('manual') && <span className="text-[9px] uppercase text-accent/70">{SRC[[...r.sources][0]!]}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function RawEditor({ personId, raw, onSave }: { personId: string; raw: string; onSave: (id: string, text: string) => void }) {
  const ref = useRef<HTMLTextAreaElement>(null)
  const [saved, setSaved] = useState(false)
  return (
    <details className="mt-3 rounded-xl border border-line">
      <summary className="flex cursor-pointer items-center gap-1.5 px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-fg3">
        <FileText size={12} /> places/{personId}.txt
      </summary>
      <div className="border-t border-line px-3 py-2.5">
        <p className="mb-1.5 text-[11px] text-fg3">
          One code per line: <code className="font-mono">PT</code>, <code className="font-mono">US-CA</code>,{' '}
          <code className="font-mono">city:Lisbon,PT</code>.
        </p>
        <textarea ref={ref} defaultValue={raw} spellCheck={false} rows={7} className="w-full rounded-lg border border-line2 bg-panel-2 px-2.5 py-2 font-mono text-[12px] text-fg focus:border-accent focus:outline-none" />
        <div className="mt-1.5 flex items-center gap-2">
          <Button variant="primary" className="!py-1.5" onClick={() => { onSave(personId, ref.current?.value ?? ''); setSaved(true); setTimeout(() => setSaved(false), 1500) }}>
            Save
          </Button>
          {saved && <span className="text-xs text-good">Saved</span>}
        </div>
      </div>
    </details>
  )
}
