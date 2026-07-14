// FormatPanel — in-app documentation of the canonical file format (so future
// you, another tool, or an AI can read/write these files), plus export buttons.

import { Download } from 'lucide-react'
import { Button, Modal } from '~/components/ui'
import { download, everythingJson, staysCsv, tripsCsv } from '~/lib/export'
import type { GeoIndex } from '~/lib/geo'
import type { Person, Stay, Trip } from '~/lib/types'

export function FormatPanel({
  open,
  onClose,
  people,
  trips,
  stays,
  placesByPerson,
  geo,
}: {
  open: boolean
  onClose: () => void
  people: Person[]
  trips: Trip[]
  stays: Stay[]
  placesByPerson: Record<string, string[]>
  geo: GeoIndex | null
}) {
  return (
    <Modal open={open} onClose={onClose} title="Your files & format" wide>
      <div className="space-y-4 text-sm leading-relaxed text-fg2">
        <p>
          Passage keeps everything in a few plain files under <code className="font-mono text-fg">v1/</code> in your
          workspace. Three models: the <b>people</b> you travel with, the <b>trips</b> they take, and the <b>stays</b>{' '}
          along the way. Readable by hand, by other tools, and by your AI. Nothing is stored anywhere else.
        </p>

        <Block file="v1/people.jsonl" desc="One person per line." code={`{"id":"mia","name":"Mia","color":"#22c07a","born":"2021-03-02"}`} />
        <Block
          file="v1/trips.jsonl"
          desc="A movement from one place to another, of a given kind. Flights use IATA codes; trains, drives, ferries and buses use city names (resolved offline) or @lat,lon."
          code={`{"type":"flight","date":"2026-06-14","from":"JFK","to":"LIS","number":"TP208","who":["travis","mia"]}\n{"type":"drive","date":"2019-07-02","from":"Boston, MA","to":"Stowe, VT","who":["travis"]}`}
        />
        <Block
          file="v1/stays.jsonl"
          desc="Somewhere you stayed: a place, optional lodging name, dates (fuzzy ok), who."
          code={`{"place":"Lisbon, PT","name":"apartment in Alfama","when":"2026-06","who":["travis","mia"]}`}
        />
        <Block
          file="v1/places/<person>.txt"
          desc="A hand-kept 'been' list, one code per line. Passage suggests additions from the log but never rewrites this file itself."
          code={`PT\nUS-CA\ncity:Lisbon,PT   # comments & blanks ok`}
        />

        <p className="text-xs text-fg3">
          Back-fill by pasting a TripIt or Flighty export into <code className="font-mono">trips.jsonl</code>, or ask your
          General Text AI to append confirmations from your inbox.
        </p>

        <div className="border-t border-line pt-4">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-fg3">Export a copy</div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => download('trips.csv', tripsCsv(trips, geo, people), 'text/csv')}>
              <Download size={14} /> Trips CSV
            </Button>
            <Button onClick={() => download('stays.csv', staysCsv(stays, people), 'text/csv')}>
              <Download size={14} /> Stays CSV
            </Button>
            <Button onClick={() => download('passage.json', everythingJson(people, trips, stays, placesByPerson), 'application/json')}>
              <Download size={14} /> Everything (JSON)
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  )
}

function Block({ file, desc, code }: { file: string; desc: string; code: string }) {
  return (
    <div>
      <code className="font-mono text-[13px] font-semibold text-accent">{file}</code>
      <p className="mt-0.5 text-[13px] text-fg3">{desc}</p>
      <pre className="mt-1.5 overflow-x-auto rounded-md bg-panel-2 px-3 py-2 font-mono text-xs text-fg2">{code}</pre>
    </div>
  )
}
