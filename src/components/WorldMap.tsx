// WorldMap.tsx — the hero: a GPU-rendered dot globe (react-globe.gl / three).
// The surface is a dark sphere; countries are drawn as fields of dots via
// hexPolygonsData (GPU-tessellated, so no per-frame work). Zoom in and the dot
// resolution steps up and the US resolves into states. Country/state outlines,
// great-circle trip arcs, and stay/airport points ride on top. Highlight of the
// inspected region runs through the cheap polygon layer, so the dot field never
// re-tessellates on a click.

import { useEffect, useMemo, useRef, useState } from 'react'
import Globe, { type GlobeMethods } from 'react-globe.gl'
import { AmbientLight, DirectionalLight, MeshPhongMaterial } from 'three'
import { feature } from 'topojson-client'
import { Minus, Plus, Locate } from 'lucide-react'
import world110m from '~/data/world-110m.json'
import usStates10m from '~/data/us-states-10m.json'
import starsUrl from '~/data/stars.jpg'
import { a2FromNum, stateFips } from '~/lib/geo'
import type { TArc, TPoint } from '~/lib/derive'

/* eslint-disable @typescript-eslint/no-explicit-any */
const world = world110m as any
const us = usStates10m as any
const COUNTRY_FEATS = ((feature(world, world.objects.countries) as any).features as any[]).map((f) => {
  const a2 = a2FromNum(String(f.id)) ?? ''
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
const STATE_FEATS = ((feature(us, us.objects.states) as any).features as any[]).map((f) => {
  const fips = String(f.id).padStart(2, '0')
  const postal = FIPS_TO_POSTAL.get(fips) ?? ''
  f.properties = f.properties || {}
  f.properties.__kind = 'state'
  f.properties.__postal = postal
  f.properties.__code = postal ? `US-${postal}` : ''
  f.properties.__name = f.properties.name ?? ''
  return f
})
// zoomed-in dot field: drop the US country outline (states replace it) so its
// dots don't double up with the state dots
const COUNTRY_NO_US = COUNTRY_FEATS.filter((f) => f.properties.__a2 !== 'US')
const COUNTRY_PLUS_STATES = [...COUNTRY_NO_US, ...STATE_FEATS]
/* eslint-enable @typescript-eslint/no-explicit-any */

// dark globe surface — the "ocean"; land reads as dots on top. Opaque so the
// (opaque) dots depth-sort cleanly against it.
const GLOBE_MATERIAL = new MeshPhongMaterial({ color: '#0c1120', shininess: 3 })

export interface MapPickRegion { kind: 'region'; code: string }
export interface MapPickPoint { kind: 'point'; point: TPoint }
export type MapPick = MapPickRegion | MapPickPoint

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v)
function hexA(hex: string, a: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex)
  if (!m) return hex
  const n = parseInt(m[1]!, 16)
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`
}
const DIM_DOT = '#6f7ca6' // muted slate — solid (opaque) so it always renders

const DEFAULT_POV = { lat: 22, lng: -35, altitude: 2.1 }

export function WorldMap({
  arcs,
  points,
  visitedCountries,
  visitedStates,
  paintRegion,
  colorOf,
  onPick,
  highlightCode,
  resetKey,
  focus,
}: {
  arcs: TArc[]
  points: TPoint[]
  visitedCountries: Set<string>
  visitedStates: Set<string>
  paintRegion: string
  colorOf: (personId: string) => string
  onPick: (pick: MapPick) => void
  highlightCode?: string | null
  resetKey?: number
  focus?: { lat: number; lng: number; altitude: number; n: number } | null
}) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const globeRef = useRef<GlobeMethods | undefined>(undefined)
  const [size, setSize] = useState({ w: 960, h: 640 })
  const [zoomedIn, setZoomedIn] = useState(false)
  // hex resolution steps up as you zoom in, so dots stay small and get denser
  // (rather than the fixed-geographic-size cells ballooning on screen)
  const [res, setRes] = useState(3)

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => {
      if (e) setSize({ w: Math.max(320, e.contentRect.width), h: Math.max(240, e.contentRect.height) })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    const g = globeRef.current
    if (!g) return
    const c = g.controls() as { autoRotate: boolean; autoRotateSpeed: number; enableDamping: boolean; dampingFactor: number }
    c.autoRotate = true
    c.autoRotateSpeed = 0.35
    c.enableDamping = true
    c.dampingFactor = 0.12
    const stop = () => (c.autoRotate = false)
    const el = wrapRef.current
    el?.addEventListener('pointerdown', stop, { once: true })
    el?.addEventListener('wheel', stop, { once: true })
    return () => {
      el?.removeEventListener('pointerdown', stop)
      el?.removeEventListener('wheel', stop)
    }
  }, [])

  useEffect(() => {
    if (resetKey === undefined) return
    globeRef.current?.pointOfView(DEFAULT_POV, 700)
  }, [resetKey])

  useEffect(() => {
    if (!focus) return
    const g = globeRef.current
    if (!g) return
    ;(g.controls() as { autoRotate: boolean }).autoRotate = false
    g.pointOfView({ lat: focus.lat, lng: focus.lng, altitude: focus.altitude }, 900)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus?.n])

  const arcsData = useMemo(
    () =>
      arcs.map((a) => {
        const c = colorOf(a.personIds[0] ?? '')
        return { startLat: a.from.lat, startLng: a.from.lon, endLat: a.to.lat, endLng: a.to.lon, gcolor: [hexA(c, 0.55), hexA(c, 1)], type: a.type }
      }),
    [arcs, colorOf],
  )
  const pointsData = useMemo(
    () => points.map((p) => ({ lat: p.lat, lng: p.lon, color: colorOf(p.personIds[0] ?? ''), kind: p.kind, ref: p })),
    [points, colorOf],
  )
  const polygons = zoomedIn ? COUNTRY_PLUS_STATES : COUNTRY_FEATS

  // dot colour: visited regions in the paint colour, everything else a dim slate.
  // Depends only on the selection (paint/visited), so it re-tessellates on filter
  // or zoom change — never on hover/click.
  const hexColor = useMemo(() => {
    return (f: object) => {
      const pr = (f as { properties: { __kind: string; __a2?: string; __postal?: string } }).properties
      const visited = pr.__kind === 'state' ? visitedStates.has(pr.__postal ?? '') : visitedCountries.has(pr.__a2 ?? '')
      return visited ? paintRegion : DIM_DOT // solid colours; visited = vivid accent, else muted slate
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paintRegion, visitedCountries, visitedStates, zoomedIn])

  // highlight (the inspected region) rides the polygon layer: a faint cap wash +
  // bright outline. Cheap — one polygon — so clicks stay instant.
  const capColor = (f: object) => {
    const code = (f as { properties: { __code?: string } }).properties.__code
    return highlightCode && code === highlightCode ? hexA(paintRegion, 0.16) : 'rgba(0,0,0,0)'
  }
  const strokeColor = (f: object) => {
    const pr = (f as { properties: { __kind: string; __code?: string } }).properties
    if (highlightCode && pr.__code === highlightCode) return hexA(paintRegion, 1)
    return pr.__kind === 'state' ? 'rgba(170,185,255,0.18)' : 'rgba(170,185,255,0.26)'
  }

  const zoomBy = (factor: number) => {
    const g = globeRef.current
    if (!g) return
    const pov = g.pointOfView()
    g.pointOfView({ altitude: clamp((pov.altitude ?? 2) * factor, 0.16, 4) }, 250)
  }

  const { w, h } = size

  return (
    <div ref={wrapRef} className="absolute inset-0 h-full w-full overflow-hidden" style={{ background: 'var(--color-space)' }}>
      <div className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(70% 60% at 50% 42%, var(--color-space-2), var(--color-space))' }} />
      <Globe
        ref={globeRef}
        width={w}
        height={h}
        backgroundColor="#06080f"
        backgroundImageUrl={starsUrl}
        globeMaterial={GLOBE_MATERIAL}
        showAtmosphere
        atmosphereColor="#7fb4ff"
        atmosphereAltitude={0.2}
        onGlobeReady={() => {
          const g = globeRef.current
          if (!g) return
          g.pointOfView(DEFAULT_POV, 0)
          const dir = new DirectionalLight(0xffffff, 0.5)
          dir.position.set(-0.4, 0.5, 1)
          g.lights([new AmbientLight(0xffffff, 1.7), dir])
        }}
        // --- the dot field ---
        hexPolygonsData={polygons}
        hexPolygonUseDots
        hexPolygonColor={hexColor}
        hexPolygonResolution={res}
        hexPolygonMargin={0.32}
        hexPolygonAltitude={0.004}
        hexPolygonCurvatureResolution={5}
        hexPolygonsTransitionDuration={0}
        // --- outlines + interaction (transparent caps) ---
        polygonsData={polygons}
        polygonCapColor={capColor}
        polygonSideColor={() => 'rgba(0,0,0,0)'}
        polygonStrokeColor={strokeColor}
        polygonAltitude={(f: object) => ((f as { properties: { __kind: string } }).properties.__kind === 'state' ? 0.009 : 0.007)}
        polygonsTransitionDuration={0}
        onPolygonClick={(f: object) => {
          const code = (f as { properties: { __code?: string } }).properties.__code
          if (code) onPick({ kind: 'region', code })
        }}
        // --- trips ---
        arcsData={arcsData}
        arcStartLat="startLat"
        arcStartLng="startLng"
        arcEndLat="endLat"
        arcEndLng="endLng"
        arcColor={(d: object) => (d as { gcolor: string[] }).gcolor}
        arcStroke={(d: object) => ((d as { type: string }).type === 'flight' ? 0.38 : 0.26)}
        arcAltitudeAutoScale={0.5}
        arcsTransitionDuration={0}
        // --- stays / airports ---
        pointsData={pointsData}
        pointLat="lat"
        pointLng="lng"
        pointColor={(d: object) => (d as { color: string }).color}
        pointAltitude={0.012}
        pointRadius={(d: object) => ((d as { kind: string }).kind === 'stay' ? 0.32 : 0.24)}
        pointsMerge={false}
        pointsTransitionDuration={0}
        onPointClick={(d: object) => onPick({ kind: 'point', point: (d as { ref: TPoint }).ref })}
        onZoom={(pov: { altitude: number }) => {
          const alt = pov.altitude
          const zi = alt < 1.3 // add US states once you're peering at a country
          setZoomedIn((cur) => (cur === zi ? cur : zi))
          // 3 = world, 4 = region/country. Capped at 4: res 5 globally would
          // tessellate ~hundreds of thousands of hexes. Going deeper wants
          // view-culling (only hex the countries near the camera) — see notes.
          const nr = alt > 1.3 ? 3 : 4
          setRes((cur) => (cur === nr ? cur : nr))
        }}
      />

      <div className="glass panel-shadow absolute bottom-4 right-4 flex flex-col overflow-hidden rounded-xl">
        <ZoomBtn label="Zoom in" onClick={() => zoomBy(0.62)}>
          <Plus size={16} />
        </ZoomBtn>
        <div className="h-px bg-glass-line" />
        <ZoomBtn label="Zoom out" onClick={() => zoomBy(1.6)}>
          <Minus size={16} />
        </ZoomBtn>
        <div className="h-px bg-glass-line" />
        <ZoomBtn label="Reset view" onClick={() => globeRef.current?.pointOfView(DEFAULT_POV, 600)}>
          <Locate size={15} />
        </ZoomBtn>
      </div>
    </div>
  )
}

function ZoomBtn({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick} className="p-2 text-fg2 hover:bg-accent-tint hover:text-accent">
      {children}
    </button>
  )
}
