// PosterView — a customizable, exportable poster of everywhere you've been. The
// same data as the globe, composed as flat wall art (d3-geo): pick a palette and
// projection, whose travels to include, per-person or a single colour, toggle
// land / routes / stays / grid, title it, and download a high-res PNG. Preview and
// export share one renderer (lib/poster.ts) so the download matches the preview.

import { useEffect, useMemo, useRef, useState } from 'react'
import { Download, X } from 'lucide-react'
import { drawPoster, POSTER_THEMES, type PosterProjection, type PosterTheme } from '~/lib/poster'
import type { DerivedGeo } from '~/lib/derive'
import type { Person } from '~/lib/types'
import { Field } from '~/components/ui'

const EXPORT_W = 2400
const EXPORT_H = 1500

export function PosterView({
  people,
  derived,
  colorOf,
  selected,
  onClose,
}: {
  people: Person[]
  derived: DerivedGeo
  colorOf: (id: string) => string
  selected: string[] | null
  onClose: () => void
}) {
  const previewRef = useRef<HTMLCanvasElement>(null)
  const previewWrap = useRef<HTMLDivElement>(null)

  const [title, setTitle] = useState('Passage')
  const [subtitle, setSubtitle] = useState('')
  const [theme, setTheme] = useState<PosterTheme>(POSTER_THEMES[0]!)
  const [projection, setProjection] = useState<PosterProjection>('naturalEarth')
  const [showLand, setShowLand] = useState(true)
  const [showArcs, setShowArcs] = useState(true)
  const [showPoints, setShowPoints] = useState(true)
  const [showGraticule, setShowGraticule] = useState(false)
  const [showCaption, setShowCaption] = useState(true)
  const [thickness, setThickness] = useState(1)
  const [singleColor, setSingleColor] = useState<string | null>(null)
  const [included, setIncluded] = useState<Set<string>>(() => new Set(selected ?? people.map((p) => p.id)))

  const includedIds = useMemo(() => people.filter((p) => included.has(p.id)).map((p) => p.id), [people, included])

  const { regions, arcs, points } = useMemo(() => {
    const inc = new Set(includedIds)
    const regionPeople = new Map<string, string[]>()
    const add = (code: string, id: string) => {
      const a = regionPeople.get(code)
      if (a) {
        if (!a.includes(id)) a.push(id)
      } else regionPeople.set(code, [id])
    }
    // country-level only — mixing US states in over the US country fill reads as
    // clashing granularity on a world poster
    for (const id of includedIds) {
      const r = derived.byPerson[id]
      if (!r) continue
      for (const a2 of r.countries.keys()) add(a2, id)
    }
    const regions = [...regionPeople].map(([code, ids]) => ({ code, colors: singleColor ? [singleColor] : ids.map(colorOf) }))
    const pickColor = (ids: string[]) => singleColor ?? colorOf(ids.find((id) => inc.has(id)) ?? ids[0] ?? '')
    const arcs = derived.arcs
      .filter((a) => a.personIds.some((id) => inc.has(id)))
      .map((a) => ({ fromLat: a.from.lat, fromLon: a.from.lon, toLat: a.to.lat, toLon: a.to.lon, color: pickColor(a.personIds) }))
    const points = derived.points
      .filter((p) => p.personIds.some((id) => inc.has(id)))
      .map((p) => ({ lat: p.lat, lon: p.lon, stay: p.kind === 'stay', color: pickColor(p.personIds) }))
    return { regions, arcs, points }
  }, [derived, includedIds, singleColor, colorOf])

  const opts = useMemo(
    () => ({
      title,
      subtitle,
      theme,
      projection,
      showLand,
      showArcs,
      showPoints,
      showGraticule,
      showCaption,
      regions,
      arcs,
      points,
      thickness,
    }),
    [title, subtitle, theme, projection, showLand, showArcs, showPoints, showGraticule, showCaption, regions, arcs, points, thickness],
  )

  // live preview
  useEffect(() => {
    const canvas = previewRef.current
    const wrap = previewWrap.current
    if (!canvas || !wrap) return
    const render = () => {
      const maxW = wrap.clientWidth - 32
      const maxH = wrap.clientHeight - 32
      if (maxW <= 0 || maxH <= 0) return
      const scale = Math.min(maxW / EXPORT_W, maxH / EXPORT_H)
      const cssW = Math.round(EXPORT_W * scale)
      const cssH = Math.round(EXPORT_H * scale)
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      canvas.width = cssW * dpr
      canvas.height = cssH * dpr
      canvas.style.width = `${cssW}px`
      canvas.style.height = `${cssH}px`
      const ctx = canvas.getContext('2d')!
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      drawPoster(ctx, cssW, cssH, opts)
    }
    render()
    const ro = new ResizeObserver(render)
    ro.observe(wrap)
    return () => ro.disconnect()
  }, [opts])

  const download = () => {
    const off = document.createElement('canvas')
    off.width = EXPORT_W
    off.height = EXPORT_H
    const ctx = off.getContext('2d')!
    drawPoster(ctx, EXPORT_W, EXPORT_H, opts)
    off.toBlob((blob) => {
      if (!blob) return
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${(title || 'passage').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-poster.png`
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    }, 'image/png')
  }

  const togglePerson = (id: string) =>
    setIncluded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next.size ? next : prev // keep at least one
    })

  const swatches = useMemo(() => [...people.map((p) => p.color), '#ffffff', '#111318'], [people])

  return (
    <div className="fixed inset-0 z-[60] flex bg-[rgba(6,10,18,0.62)] backdrop-blur-sm">
      {/* preview */}
      <div ref={previewWrap} className="flex min-w-0 flex-1 items-center justify-center p-4">
        <canvas ref={previewRef} className="rounded-lg shadow-2xl" />
      </div>

      {/* controls */}
      <div className="flex w-80 shrink-0 flex-col overflow-y-auto border-l border-line bg-panel">
        <div className="flex items-center justify-between border-b border-line px-3.5 py-3">
          <h2 className="font-serif text-lg font-semibold">Poster</h2>
          <button type="button" onClick={onClose} className="rounded-md p-1 text-fg3 hover:bg-panel-2 hover:text-fg" aria-label="Close poster">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4 p-3.5">
          <Field label="Title">
            <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full rounded-md border border-line2 bg-panel px-2.5 py-1.5 text-sm outline-none focus:border-accent" />
          </Field>
          <Field label="Subtitle">
            <input value={subtitle} onChange={(e) => setSubtitle(e.target.value)} placeholder="e.g. a life in transit · 2026" className="w-full rounded-md border border-line2 bg-panel px-2.5 py-1.5 text-sm outline-none focus:border-accent" />
          </Field>

          <Field label="Palette">
            <div className="grid grid-cols-2 gap-1.5">
              {POSTER_THEMES.map((t) => (
                <button
                  key={t.name}
                  type="button"
                  onClick={() => setTheme(t)}
                  className={`flex items-center gap-2 rounded-md border px-2 py-1.5 text-sm ${theme.name === t.name ? 'border-accent text-fg' : 'border-line2 text-fg2 hover:bg-panel-2'}`}
                >
                  <span className="h-4 w-4 rounded-full border border-black/10" style={{ background: t.bg }} />
                  {t.name}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Projection">
            <div className="flex gap-1.5">
              {(['naturalEarth', 'equalEarth'] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setProjection(p)}
                  className={`flex-1 rounded-md border px-2 py-1.5 text-sm ${projection === p ? 'border-accent text-fg' : 'border-line2 text-fg2 hover:bg-panel-2'}`}
                >
                  {p === 'naturalEarth' ? 'Natural Earth' : 'Equal Earth'}
                </button>
              ))}
            </div>
          </Field>

          {people.length > 0 && (
            <Field label="Whose travels">
              <div className="space-y-1">
                {people.map((p) => (
                  <label key={p.id} className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 text-sm hover:bg-panel-2">
                    <input type="checkbox" checked={included.has(p.id)} onChange={() => togglePerson(p.id)} className="accent-[var(--color-accent)]" />
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: p.color }} />
                    <span className="text-fg2">{p.name}</span>
                  </label>
                ))}
              </div>
            </Field>
          )}

          <Field label="Fill colour">
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setSingleColor(null)}
                className={`rounded-md border px-2 py-1 text-xs ${singleColor === null ? 'border-accent text-fg' : 'border-line2 text-fg3 hover:bg-panel-2'}`}
              >
                Per person
              </button>
              {swatches.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={c}
                  onClick={() => setSingleColor(c)}
                  className="h-6 w-6 rounded-full border border-black/10"
                  style={{ background: c, outline: singleColor === c ? '2px solid var(--color-fg)' : 'none', outlineOffset: 2 }}
                />
              ))}
            </div>
          </Field>

          <Field label="Line thickness">
            <input type="range" min={0.5} max={2.5} step={0.1} value={thickness} onChange={(e) => setThickness(Number(e.target.value))} className="w-full accent-[var(--color-accent)]" />
          </Field>

          <div className="space-y-1.5">
            <Toggle label="Land" checked={showLand} onChange={setShowLand} />
            <Toggle label="Routes" checked={showArcs} onChange={setShowArcs} />
            <Toggle label="Stays & stops" checked={showPoints} onChange={setShowPoints} />
            <Toggle label="Graticule" checked={showGraticule} onChange={setShowGraticule} />
            <Toggle label="Caption" checked={showCaption} onChange={setShowCaption} />
          </div>
        </div>

        <div className="mt-auto border-t border-line p-3.5">
          <button type="button" onClick={download} className="flex w-full items-center justify-center gap-2 rounded-md bg-accent px-3 py-2 text-sm font-semibold text-accent-fg hover:opacity-90">
            <Download size={16} />
            Download PNG
          </button>
        </div>
      </div>
    </div>
  )
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 text-sm text-fg2 hover:bg-panel-2">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="accent-[var(--color-accent)]" />
      {label}
    </label>
  )
}
