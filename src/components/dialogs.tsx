// Add/edit dialogs for trips, stays, and people. Native <dialog> via Modal;
// dense, labelled fields; offline autocomplete for both airport codes (flights)
// and city names (everything else + stays), backed by the bundled geo index.

import { useMemo, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { Button, Field, inputClass, Modal, PersonChips } from '~/components/ui'
import type { GeoIndex } from '~/lib/geo'
import { ARRIVE_LABELS, TripTypeIcon } from '~/components/icons'
import { type Person, PERSON_COLORS, type Stay, type Trip, TRIP_META, TRIP_TYPES, type TripType } from '~/lib/types'

function today(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

function WhoRow({ people, who, setWho }: { people: Person[]; who: string[]; setWho: (w: string[]) => void }) {
  const set = useMemo(() => new Set(who), [who])
  return (
    <Field label="Who">
      {people.length ? (
        <PersonChips people={people} selected={set} onToggle={(id) => setWho(set.has(id) ? who.filter((x) => x !== id) : [...who, id])} />
      ) : (
        <p className="text-sm text-fg4">Add a person first.</p>
      )}
    </Field>
  )
}

// One endpoint input: IATA autocomplete for flights, city autocomplete otherwise.
function EndpointInput({
  value,
  onChange,
  geo,
  mode,
  placeholder,
}: {
  value: string
  onChange: (v: string) => void
  geo: GeoIndex | null
  mode: 'iata' | 'place'
  placeholder?: string
}) {
  const [focus, setFocus] = useState(false)
  const q = value.trim()

  const suggestions = useMemo(() => {
    if (!geo || q.length < 2) return [] as { primary: string; secondary: string; value: string }[]
    if (mode === 'iata') {
      const up = q.toUpperCase()
      const out: { primary: string; secondary: string; value: string }[] = []
      for (const a of Object.values(geo.airports)) {
        if (a.iata.startsWith(up) || a.city.toLowerCase().includes(q.toLowerCase())) {
          out.push({ primary: a.iata, secondary: `${a.city} · ${a.name}`, value: a.iata })
          if (out.length > 40) break
        }
      }
      return out.sort((a, b) => (a.primary === up ? -1 : b.primary === up ? 1 : a.primary.localeCompare(b.primary))).slice(0, 7)
    }
    // city mode: list is population-sorted, so first matches are the biggest
    const ql = q.toLowerCase().split(',')[0]!.trim()
    const out: { primary: string; secondary: string; value: string }[] = []
    for (const c of geo.cities.list) {
      if (c[0].toLowerCase().startsWith(ql)) {
        const region = c[3] === 'US' && c[4] ? c[4] : c[3]
        out.push({ primary: c[0], secondary: region, value: `${c[0]}, ${region}` })
        if (out.length >= 7) break
      }
    }
    return out
  }, [geo, q, mode])

  return (
    <div className="relative">
      <input
        className={inputClass + (mode === 'iata' ? ' uppercase' : '')}
        value={value}
        onChange={(e) => onChange(mode === 'iata' ? e.target.value.toUpperCase().slice(0, 4) : e.target.value)}
        onFocus={() => setFocus(true)}
        onBlur={() => setTimeout(() => setFocus(false), 130)}
        placeholder={placeholder}
        autoComplete="off"
        spellCheck={false}
      />
      {focus && suggestions.length > 0 && (
        <ul className="glass panel-shadow absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-md py-1">
          {suggestions.map((s, i) => (
            <li key={s.value + i}>
              <button
                type="button"
                className="flex w-full items-baseline gap-2 px-3 py-1.5 text-left text-sm hover:bg-accent-tint"
                onMouseDown={(e) => {
                  e.preventDefault()
                  onChange(s.value)
                  setFocus(false)
                }}
              >
                <span className={mode === 'iata' ? 'font-mono font-semibold text-accent' : 'font-medium text-fg'}>{s.primary}</span>
                <span className="truncate text-fg3">{s.secondary}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function TripDialog({
  open,
  onClose,
  people,
  geo,
  initial,
  onSave,
  onDelete,
}: {
  open: boolean
  onClose: () => void
  people: Person[]
  geo: GeoIndex | null
  initial?: Trip
  onSave: (t: Partial<Trip> & Pick<Trip, 'type' | 'from' | 'to' | 'who'>) => void
  onDelete?: () => void
}) {
  const [type, setType] = useState<TripType>(initial?.type ?? 'flight')
  const [date, setDate] = useState(initial?.date ?? today())
  const [from, setFrom] = useState(initial?.from ?? '')
  const [to, setTo] = useState(initial?.to ?? '')
  const [carrier, setCarrier] = useState(initial?.carrier ?? '')
  const [number, setNumber] = useState(initial?.number ?? '')
  const [who, setWho] = useState<string[]>(initial?.who ?? people.map((p) => p.id))
  const [note, setNote] = useState(initial?.note ?? '')

  const meta = TRIP_META[type]
  const mode = meta.codeInput ? 'iata' : 'place'
  const valid = from.trim() && to.trim() && who.length > 0

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial ? 'Edit trip' : 'Add a trip'}
      footer={
        <>
          {onDelete && (
            <Button variant="danger" onClick={onDelete} className="mr-auto">
              <Trash2 size={15} /> Delete
            </Button>
          )}
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            disabled={!valid}
            onClick={() => valid && onSave({ id: initial?.id, type, date, from: from.trim(), to: to.trim(), carrier, number, who, note })}
          >
            Save
          </Button>
        </>
      }
    >
      <div className="space-y-3.5">
        <div className="flex flex-wrap gap-1.5">
          {TRIP_TYPES.map((tt) => (
            <button
              key={tt}
              type="button"
              onClick={() => setType(tt)}
              aria-pressed={type === tt}
              className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[13px] font-medium capitalize transition-colors ${
                type === tt ? 'border-accent bg-accent-tint text-accent' : 'border-line2 text-fg3 hover:text-fg2'
              }`}
            >
              <TripTypeIcon type={tt} size={14} />
              {tt}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="From" hint={mode === 'iata' ? 'airport code' : 'city'}>
            <EndpointInput value={from} onChange={setFrom} geo={geo} mode={mode} placeholder={mode === 'iata' ? 'JFK' : 'Boston, MA'} />
          </Field>
          <Field label="To" hint={mode === 'iata' ? 'airport code' : 'city'}>
            <EndpointInput value={to} onChange={setTo} geo={geo} mode={mode} placeholder={mode === 'iata' ? 'LIS' : 'Stowe, VT'} />
          </Field>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <Field label="Date">
            <input type="date" className={inputClass} value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          {meta.carrierLabel ? (
            <Field label={meta.carrierLabel} hint="optional">
              <input className={inputClass} value={carrier} onChange={(e) => setCarrier(e.target.value)} />
            </Field>
          ) : (
            <div />
          )}
          {(type === 'flight' || type === 'train') && (
            <Field label={type === 'flight' ? 'Flight #' : 'Train #'} hint="optional">
              <input className={inputClass} value={number} onChange={(e) => setNumber(e.target.value)} placeholder={type === 'flight' ? 'TP208' : ''} />
            </Field>
          )}
        </div>

        <WhoRow people={people} who={who} setWho={setWho} />
        <Field label="Note" hint="optional">
          <input className={inputClass} value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
        {mode === 'place' && (
          <p className="text-xs text-fg4">
            {ARRIVE_LABELS[type]} between cities. Tiny towns not in the gazetteer still log fine — they just won't drop a
            pin unless you add coordinates by hand.
          </p>
        )}
      </div>
    </Modal>
  )
}

export function StayDialog({
  open,
  onClose,
  people,
  geo,
  initial,
  onSave,
  onDelete,
}: {
  open: boolean
  onClose: () => void
  people: Person[]
  geo: GeoIndex | null
  initial?: Stay
  onSave: (s: Partial<Stay> & Pick<Stay, 'place' | 'who'>) => void
  onDelete?: () => void
}) {
  const [place, setPlace] = useState(initial?.place ?? '')
  const [name, setName] = useState(initial?.name ?? '')
  const [when, setWhen] = useState(initial?.when ?? '')
  const [who, setWho] = useState<string[]>(initial?.who ?? people.map((p) => p.id))
  const [note, setNote] = useState(initial?.note ?? '')
  const [lat, setLat] = useState(initial?.lat != null ? String(initial.lat) : '')
  const [lon, setLon] = useState(initial?.lon != null ? String(initial.lon) : '')

  const valid = place.trim().length > 0 && who.length > 0

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial ? 'Edit stay' : 'Add a stay'}
      footer={
        <>
          {onDelete && (
            <Button variant="danger" onClick={onDelete} className="mr-auto">
              <Trash2 size={15} /> Delete
            </Button>
          )}
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            disabled={!valid}
            onClick={() =>
              valid &&
              onSave({
                id: initial?.id,
                place: place.trim(),
                name: name.trim() || undefined,
                when: when.trim() || undefined,
                who,
                note: note.trim() || undefined,
                lat: lat ? Number(lat) : undefined,
                lon: lon ? Number(lon) : undefined,
              })
            }
          >
            Save
          </Button>
        </>
      }
    >
      <div className="space-y-3.5">
        <Field label="Place" hint="city — resolves to the map">
          <EndpointInput value={place} onChange={setPlace} geo={geo} mode="place" placeholder="Lisbon, PT" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Lodging" hint="hotel, friend's house — optional">
            <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="apartment in Alfama" />
          </Field>
          <Field label="When" hint='fuzzy ok: "summer 2019"'>
            <input className={inputClass} value={when} onChange={(e) => setWhen(e.target.value)} placeholder="2026-06" />
          </Field>
        </div>
        <WhoRow people={people} who={who} setWho={setWho} />
        <details className="rounded-md border border-line px-3 py-2">
          <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wider text-fg3">Coordinates & note</summary>
          <div className="mt-3 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Latitude" hint="overrides the pin">
                <input className={inputClass} value={lat} onChange={(e) => setLat(e.target.value)} inputMode="decimal" placeholder="38.712" />
              </Field>
              <Field label="Longitude">
                <input className={inputClass} value={lon} onChange={(e) => setLon(e.target.value)} inputMode="decimal" placeholder="-9.139" />
              </Field>
            </div>
            <Field label="Note">
              <input className={inputClass} value={note} onChange={(e) => setNote(e.target.value)} />
            </Field>
          </div>
        </details>
      </div>
    </Modal>
  )
}

export function PersonDialog({
  open,
  onClose,
  initial,
  onSave,
  onDelete,
}: {
  open: boolean
  onClose: () => void
  initial?: Person
  onSave: (p: { id?: string; name: string; color: string; born?: string }) => void
  onDelete?: () => void
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [color, setColor] = useState(initial?.color ?? PERSON_COLORS[0])
  const [born, setBorn] = useState(initial?.born ?? '')
  const valid = name.trim().length > 0

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial ? 'Edit person' : 'Add a person'}
      footer={
        <>
          {onDelete && (
            <Button variant="danger" onClick={onDelete} className="mr-auto">
              <Trash2 size={15} /> Remove
            </Button>
          )}
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={!valid} onClick={() => valid && onSave({ id: initial?.id, name: name.trim(), color, born: born || undefined })}>
            Save
          </Button>
        </>
      }
    >
      <div className="space-y-3.5">
        <Field label="Name">
          <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="Mia" autoFocus />
        </Field>
        <Field label="Colour" hint="this person's map layer">
          <div className="flex flex-wrap items-center gap-2">
            {PERSON_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={c}
                onClick={() => setColor(c)}
                className={`h-7 w-7 rounded-full ${color === c ? 'ring-2 ring-fg ring-offset-2 ring-offset-panel' : ''}`}
                style={{ backgroundColor: c }}
              />
            ))}
            <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-7 w-9 cursor-pointer rounded border border-line2 bg-transparent" aria-label="Custom colour" />
          </div>
        </Field>
        <Field label="Born" hint="optional — enables a complete-from-birth log">
          <input type="date" className={inputClass} value={born} onChange={(e) => setBorn(e.target.value)} />
        </Field>
      </div>
    </Modal>
  )
}
