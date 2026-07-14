// WorldMap.tsx — the hero: a GPU globe (react-globe.gl / three) with a SHADED
// vector map. Land is drawn as filled country polygons (10m Natural Earth, so
// coastlines stay crisp all the way in — it's geometry, not pixels); visited
// countries are painted in the accent, everything else a muted land tone. Zoom
// in and the US resolves into filled states. Trip arcs, stay/airport points,
// country/state outlines, atmosphere and a starfield ride on top.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Globe, { type GlobeMethods } from 'react-globe.gl'
import { AmbientLight, CanvasTexture, Color, DirectionalLight, LinearFilter, MeshLambertMaterial, MeshPhongMaterial, RepeatWrapping } from 'three'
import { Line2 } from 'three/examples/jsm/lines/Line2.js'
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js'
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js'
import { Minus, Plus, Locate } from 'lucide-react'
import starsUrl from '~/data/stars.jpg'
import { COUNTRY_FEATS, COUNTRY_PLUS_STATES } from '~/lib/features'
import type { TArc, TPoint } from '~/lib/derive'

const DEG = Math.PI / 180
// three-globe's sphere convention (GLOBE_RADIUS = 100; altitude is a fraction of
// it). Matches globe.getCoords so our arcs land exactly where the markers do.
const GLOBE_R = 100
// Land polygons sit at this altitude; marks + arc endpoints share it so all three
// layers lie on the same plane and never parallax apart on zoom.
const SURFACE_ALT = 0.006
const polar = (lat: number, lng: number, alt: number): [number, number, number] => {
  const phi = (90 - lat) * DEG
  const theta = (90 - lng) * DEG
  const r = GLOBE_R * (1 + alt)
  return [r * Math.sin(phi) * Math.cos(theta), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(theta)]
}

// Trip arcs are drawn as fat lines (Line2). Unlike the built-in tube arcs, the
// width is in SCREEN pixels (worldUnits:false) so it stays constant at every
// zoom instead of ballooning; unlike the plain THREE.Line it can be a touch
// thicker than 1px. One shared material — per-arc colour rides on the geometry.
const ARC_MAT = new LineMaterial({ vertexColors: true, worldUnits: false, transparent: true, opacity: 0.95, depthTest: true, depthWrite: false })

export interface MapPickRegion { kind: 'region'; code: string }
export interface MapPickPoint { kind: 'point'; point: TPoint }
export type MapPick = MapPickRegion | MapPickPoint

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v)
// parse "#rrggbb" OR "rgb(r,g,b)" — helpers feed their own rgb() output back in
// (e.g. inkify → mix), so both forms must round-trip
function rgb(c: string): [number, number, number] {
  const h = /^#?([0-9a-f]{6})$/i.exec(c)
  if (h) {
    const n = parseInt(h[1]!, 16)
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
  }
  const m = /rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i.exec(c)
  if (m) return [Math.round(+m[1]!), Math.round(+m[2]!), Math.round(+m[3]!)]
  return [107, 124, 255]
}
const hexA = (hex: string, a: number) => { const [r, g, b] = rgb(hex); return `rgba(${r},${g},${b},${a})` }
const lighten = (hex: string, t: number) => { const [r, g, b] = rgb(hex); const l = (c: number) => Math.round(c + (255 - c) * t); return `rgb(${l(r)},${l(g)},${l(b)})` }
const mix = (a: string, b: string, t: number) => { const [ar, ag, ab] = rgb(a); const [br, bg, bb] = rgb(b); const m = (x: number, y: number) => Math.round(x + (y - x) * t); return `rgb(${m(ar, br)},${m(ag, bg)},${m(ab, bb)})` }

// The whole map palette lives in one place so it can be swapped behind a toggle.
// MODERN = the dark, blue, star-field globe; PAPER = an old-map parchment look
// with sepia ink, muted colours, and dashed routes.
export type MapStyle = 'modern' | 'paper'
export interface Pal {
  ocean: string // globe sphere
  shininess: number
  land: string // unvisited land + the tone visited fills blend toward
  strokeCountry: string
  strokeState: string
  highlightStroke: string
  bg: string // globe canvas background
  wrapperBg: string // container behind the canvas (CSS colour or var)
  radial: string // soft vignette gradient over the container
  stars: boolean
  atmosphere: string
  atmAlt: number
  ambient: number
  directional: number
  markAirportBg: string
  markRing: string
  markGlow: boolean
  ink: boolean // mute bright traveller colours toward sepia
  dashed: boolean // dashed routes (paper)
  arcOpacity: number
  solidOpacity: number
  hatchOpacity: number
  hatchMix: number // how far hatch colours blend toward land
  hatchRepeat: number // stripe frequency (lower = coarser, more legible)
}
export const MODERN: Pal = {
  ocean: '#0b1122', shininess: 6, land: '#222b46',
  strokeCountry: 'rgba(150,168,220,0.30)', strokeState: 'rgba(150,168,220,0.16)', highlightStroke: '#aeb8ff',
  bg: '#06080f', wrapperBg: 'var(--color-space)', radial: 'radial-gradient(70% 60% at 50% 42%, var(--color-space-2), var(--color-space))',
  stars: true, atmosphere: '#7fb4ff', atmAlt: 0.2, ambient: 2.2, directional: 0.65,
  markAirportBg: 'rgba(9,12,20,0.85)', markRing: 'rgba(255,255,255,0.85)', markGlow: true,
  ink: false, dashed: false, arcOpacity: 0.95, solidOpacity: 0.55, hatchOpacity: 0.62, hatchMix: 0.15, hatchRepeat: 1,
}
export const PAPER: Pal = {
  ocean: '#c4b184', shininess: 1, land: '#ece0c2',
  strokeCountry: 'rgba(96,74,49,0.6)', strokeState: 'rgba(96,74,49,0.32)', highlightStroke: '#4a3a1e',
  bg: '#e7dcc0', wrapperBg: '#e2d6b6', radial: 'radial-gradient(78% 68% at 50% 42%, #f2e9d2, #d6c7a1)',
  stars: false, atmosphere: '#d8c39c', atmAlt: 0.12, ambient: 3.15, directional: 0.32,
  markAirportBg: '#f3ebd7', markRing: '#5b4a32', markGlow: false,
  ink: true, dashed: true, arcOpacity: 0.95, solidOpacity: 0.72, hatchOpacity: 0.85, hatchMix: 0.04, hatchRepeat: 1.4,
}
// mute a bright modern colour toward sepia ink for the paper palette (keep enough
// chroma that travellers stay distinguishable in the hatch)
const inkify = (hex: string) => mix(hex, '#7a5f38', 0.26)

// Land-fill materials, cached by signature (palette-aware). ONE person → a
// translucent tint of their colour; SEVERAL → a diagonal hatch cycling their
// colours (old-map style, so overlapping travellers stay legible). Lit (Lambert)
// to match the shaded globe.
const matCache = new Map<string, MeshLambertMaterial>()
function landMat(pal: Pal): MeshLambertMaterial {
  const key = `L:${pal.land}`
  let m = matCache.get(key)
  if (!m) matCache.set(key, (m = new MeshLambertMaterial({ color: new Color(pal.land) })))
  return m
}
function solidMat(color: string, pal: Pal): MeshLambertMaterial {
  const key = `s:${pal.land}:${color}:${pal.solidOpacity}`
  let m = matCache.get(key)
  if (!m) matCache.set(key, (m = new MeshLambertMaterial({ color: new Color(mix(color, pal.land, 0.28)), transparent: true, opacity: pal.solidOpacity })))
  return m
}
function hatchMat(colors: string[], pal: Pal): MeshLambertMaterial {
  const key = `h:${pal.land}:${colors.join('|')}:${pal.hatchOpacity}`
  let m = matCache.get(key)
  if (m) return m
  const n = colors.length
  // A few colour cycles per tile so striping shows regardless of a polygon's UV
  // scale. Crucially, mipmaps are OFF: trilinear minification would otherwise blur
  // the fine stripes into a single flat average colour on smaller countries.
  const per = 10 // px per band
  const bands = n * 3 // 3 cycles of the colour sequence per tile
  const S = per * bands
  const cv = document.createElement('canvas')
  cv.width = cv.height = S
  const ctx = cv.getContext('2d')!
  for (let j = 0; j < bands; j++) {
    ctx.fillStyle = mix(colors[j % n]!, pal.land, pal.hatchMix)
    ctx.fillRect(j * per, 0, per + 1, S) // +1 avoids seam gaps between bands
  }
  const tex = new CanvasTexture(cv)
  tex.wrapS = tex.wrapT = RepeatWrapping
  tex.generateMipmaps = false
  tex.minFilter = LinearFilter
  tex.magFilter = LinearFilter
  tex.repeat.set(pal.hatchRepeat, pal.hatchRepeat)
  tex.center.set(0.5, 0.5)
  tex.rotation = Math.PI / 4 // vertical bands -> diagonal stripes
  tex.needsUpdate = true
  m = new MeshLambertMaterial({ map: tex, transparent: true, opacity: pal.hatchOpacity })
  matCache.set(key, m)
  return m
}
function brightMat(color: string, pal: Pal): MeshLambertMaterial {
  const key = `b:${pal.land}:${color}`
  let m = matCache.get(key)
  if (!m) matCache.set(key, (m = new MeshLambertMaterial({ color: new Color(lighten(color, 0.3)), transparent: true, opacity: 0.72 })))
  return m
}

const DEFAULT_POV = { lat: 22, lng: -35, altitude: 2.1 }

export function WorldMap({
  arcs,
  points,
  regionPeople,
  paintRegion,
  colorOf,
  onPick,
  highlightCode,
  resetKey,
  focus,
  panels,
  style = 'modern',
}: {
  arcs: TArc[]
  points: TPoint[]
  /** region code (a2 or "US-XX") → ids of the selected people who visited it */
  regionPeople: Map<string, string[]>
  paintRegion: string
  colorOf: (personId: string) => string
  onPick: (pick: MapPick) => void
  highlightCode?: string | null
  resetKey?: number
  focus?: { lat: number; lng: number; altitude: number; n: number } | null
  /** which side panels are open, so the globe can re-centre into the free space */
  panels?: { left: boolean; right: boolean }
  /** map palette: 'modern' (dark/blue/stars) or 'paper' (old-map parchment) */
  style?: MapStyle
}) {
  const pal = style === 'paper' ? PAPER : MODERN
  // traveller colours ride through inkify() in paper mode so bright blues/reds
  // settle into a muted, hand-inked palette
  const mapColor = useCallback((id: string) => (pal.ink ? inkify(colorOf(id)) : colorOf(id)), [pal.ink, colorOf])
  const globeMaterial = useMemo(() => new MeshPhongMaterial({ color: new Color(pal.ocean), shininess: pal.shininess }), [pal])
  const wrapRef = useRef<HTMLDivElement>(null)
  const globeRef = useRef<GlobeMethods | undefined>(undefined)
  const [size, setSize] = useState({ w: 960, h: 640 })
  const [zoomedIn, setZoomedIn] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => {
      if (e) setSize({ w: Math.max(320, e.contentRect.width), h: Math.max(240, e.contentRect.height) })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // fat-line arcs measure their width against the renderer's pixel buffer, so the
  // material's resolution must track the canvas size (× DPR) or lines vanish/blur.
  useEffect(() => {
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1
    ARC_MAT.resolution.set(size.w * dpr, size.h * dpr)
    ARC_MAT.linewidth = 2 * dpr // ~2 CSS px, constant at every zoom
  }, [size])

  useEffect(() => {
    const g = globeRef.current
    if (!g) return
    const c = g.controls() as { autoRotate: boolean; autoRotateSpeed: number; enableDamping: boolean; dampingFactor: number; minDistance: number }
    c.autoRotate = true
    c.autoRotateSpeed = 0.35
    c.enableDamping = true
    c.dampingFactor = 0.12
    c.minDistance = 101 // allow zooming right down to the surface
    const stop = () => (c.autoRotate = false)
    const el = wrapRef.current
    el?.addEventListener('pointerdown', stop, { once: true })
    el?.addEventListener('wheel', stop, { once: true })
    return () => {
      el?.removeEventListener('pointerdown', stop)
      el?.removeEventListener('wheel', stop)
    }
  }, [])

  // Globe-instance setup. onGlobeReady fires before React attaches globeRef, so we
  // do the imperative setup here — this effect runs after the ref exists.
  useEffect(() => {
    if (!ready) return
    globeRef.current?.pointOfView(DEFAULT_POV, 0)
  }, [ready])

  // lights follow the palette (paper is flatter/brighter, like a printed map);
  // separate from the view so toggling the style never yanks the camera.
  useEffect(() => {
    if (!ready) return
    const g = globeRef.current
    if (!g) return
    const dir = new DirectionalLight(0xffffff, pal.directional)
    dir.position.set(-0.4, 0.5, 1)
    g.lights([new AmbientLight(0xffffff, pal.ambient), dir])
  }, [ready, pal])

  // arc material follows the palette: dashed sepia routes on paper, solid on modern
  useEffect(() => {
    ARC_MAT.opacity = pal.arcOpacity
    ARC_MAT.dashed = pal.dashed
    ARC_MAT.dashSize = 1.6
    ARC_MAT.gapSize = 1.1
    ARC_MAT.needsUpdate = true
  }, [pal])

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

  // re-centre the globe into the free space when side panels are open. The canvas
  // stays full-bleed (starfield still shows behind the glass panels); we just
  // offset the camera frustum so the globe's optical centre sits in the gap.
  useEffect(() => {
    const g = globeRef.current
    if (!g) return
    const cam = g.camera() as unknown as {
      setViewOffset: (fw: number, fh: number, x: number, y: number, w: number, h: number) => void
      clearViewOffset: () => void
      updateProjectionMatrix: () => void
    }
    const { w, h } = size
    const leftOcc = panels?.left ? Math.min(392, w * 0.45) : 0
    const rightOcc = panels?.right ? Math.min(352, w * 0.45) : 0
    const shift = (leftOcc - rightOcc) / 2 // +ve → move the globe right
    if (Math.abs(shift) < 1) cam.clearViewOffset()
    else cam.setViewOffset(w, h, -shift, 0, w, h)
    cam.updateProjectionMatrix()
  }, [panels?.left, panels?.right, size, ready])

  const arcsData = useMemo(
    () =>
      arcs.map((a) => {
        const cs = a.personIds.map(mapColor)
        const base = cs[0] ?? mapColor('')
        // a lone traveller runs faint→bright in their colour (a sense of
        // direction); a shared trip blends through everyone's colours
        const stops = cs.length <= 1 ? [mix(base, pal.land, 0.5), lighten(base, 0.15)] : cs
        return { startLat: a.from.lat, startLng: a.from.lon, endLat: a.to.lat, endLng: a.to.lon, stops, type: a.type }
      }),
    [arcs, mapColor, pal],
  )
  // Build one fat-line arc: a great circle sampled with a raised mid-section, its
  // endpoints on the surface (altitude 0) so they sit exactly under the markers.
  // Colour runs faint (near the land tone) at the origin to bright at the target.
  const buildArc = useCallback((d: object) => {
    const a = d as { startLat: number; startLng: number; endLat: number; endLng: number; stops: string[]; type: string }
    const toU = (la: number, lo: number): [number, number, number] => [Math.cos(la * DEG) * Math.cos(lo * DEG), Math.cos(la * DEG) * Math.sin(lo * DEG), Math.sin(la * DEG)]
    const A = toU(a.startLat, a.startLng)
    const B = toU(a.endLat, a.endLng)
    const dot = clamp(A[0] * B[0] + A[1] * B[1] + A[2] * B[2], -1, 1)
    const ang = Math.acos(dot)
    const sin = Math.sin(ang)
    // flights bow higher; every arc keeps a minimum bow so even a short drive
    // lifts off the surface and reads as an arc instead of vanishing flat on it
    const maxAlt = Math.max(a.type === 'flight' ? 0.06 : 0.035, (a.type === 'flight' ? 0.5 : 0.32) * (ang / Math.PI))
    // colour ramp along the arc (stops are pre-computed per palette upstream)
    const stops = (a.stops.length ? a.stops : ['#6b7cff']).map((c) => new Color(c))
    const colorAt = (t: number): Color => {
      if (stops.length === 1) return stops[0]!
      const x = t * (stops.length - 1)
      const i = Math.min(stops.length - 2, Math.floor(x))
      return stops[i]!.clone().lerp(stops[i + 1]!, x - i)
    }
    const N = 64
    const pos: number[] = []
    const col: number[] = []
    for (let i = 0; i <= N; i++) {
      const t = i / N
      let v: [number, number, number]
      if (ang < 1e-6) v = A
      else {
        const s0 = Math.sin((1 - t) * ang) / sin
        const s1 = Math.sin(t * ang) / sin
        v = [A[0] * s0 + B[0] * s1, A[1] * s0 + B[1] * s1, A[2] * s0 + B[2] * s1]
      }
      const lat = Math.asin(clamp(v[2], -1, 1)) / DEG
      const lng = Math.atan2(v[1], v[0]) / DEG
      const p = polar(lat, lng, SURFACE_ALT + maxAlt * Math.sin(Math.PI * t))
      pos.push(p[0], p[1], p[2])
      const c = colorAt(t)
      col.push(c.r, c.g, c.b)
    }
    const geom = new LineGeometry()
    geom.setPositions(pos)
    geom.setColors(col)
    const line = new Line2(geom, ARC_MAT)
    line.computeLineDistances() // needed for dashed (paper) routes
    return line
  }, [])
  const pointsData = useMemo(
    () => points.map((p) => ({ lat: p.lat, lng: p.lon, color: mapColor(p.personIds[0] ?? ''), kind: p.kind, ref: p })),
    [points, mapColor],
  )
  // Stay/airport markers are HTML (CSS2D) elements, not 3D geometry, so they hold
  // a constant SCREEN size at every zoom (no ballooning cylinders) and auto-hide
  // when they rotate behind the globe. Stays are filled dots; airports hollow.
  const htmlMarker = useCallback(
    (d: object) => {
      const pt = d as { color: string; kind: string; ref: TPoint }
      const stay = pt.kind === 'stay'
      const s = stay ? 9 : 7
      const el = document.createElement('div')
      const shadow = pal.markGlow ? `0 0 6px ${hexA(pt.color, 0.7)}` : '0 1px 2px rgba(60,45,25,0.55)'
      el.style.cssText = `width:${s}px;height:${s}px;border-radius:50%;box-sizing:border-box;background:${
        stay ? pt.color : pal.markAirportBg
      };border:1.5px solid ${stay ? pal.markRing : pt.color};box-shadow:${shadow};cursor:pointer;`
      el.title = pt.ref.label
      el.addEventListener('click', (e) => {
        e.stopPropagation()
        onPick({ kind: 'point', point: pt.ref })
      })
      return el
    },
    [onPick, pal],
  )
  const polygons = zoomedIn ? COUNTRY_PLUS_STATES : COUNTRY_FEATS

  const capMaterial = (f: object) => {
    const code = (f as { properties: { __code?: string } }).properties.__code ?? ''
    const ppl = regionPeople.get(code)
    if (highlightCode && code === highlightCode) return brightMat(ppl?.[0] ? mapColor(ppl[0]) : (pal.ink ? inkify(paintRegion) : paintRegion), pal)
    if (!ppl || ppl.length === 0) return landMat(pal)
    if (ppl.length === 1) return solidMat(mapColor(ppl[0]!), pal) // one traveller: translucent tint
    return hatchMat(ppl.map(mapColor), pal) // several: diagonal hatch of their colours
  }
  const strokeColor = (f: object) => {
    const pr = (f as { properties: { __kind: string; __code?: string } }).properties
    if (highlightCode && pr.__code === highlightCode) return pal.highlightStroke
    return pr.__kind === 'state' ? pal.strokeState : pal.strokeCountry
  }

  const zoomBy = (factor: number) => {
    const g = globeRef.current
    if (!g) return
    const pov = g.pointOfView()
    g.pointOfView({ altitude: clamp((pov.altitude ?? 2) * factor, 0.03, 4) }, 250)
  }

  const { w, h } = size

  return (
    <div ref={wrapRef} className="absolute inset-0 h-full w-full overflow-hidden" style={{ background: pal.wrapperBg }}>
      <div className="pointer-events-none absolute inset-0" style={{ background: pal.radial }} />
      <Globe
        ref={globeRef}
        width={w}
        height={h}
        backgroundColor={pal.bg}
        backgroundImageUrl={pal.stars ? starsUrl : null}
        globeMaterial={globeMaterial}
        showAtmosphere
        atmosphereColor={pal.atmosphere}
        atmosphereAltitude={pal.atmAlt}
        onGlobeReady={() => setReady(true)}
        // --- shaded land ---
        polygonsData={polygons}
        polygonCapMaterial={capMaterial}
        polygonSideColor={() => 'rgba(0,0,0,0)'}
        polygonStrokeColor={strokeColor}
        polygonAltitude={SURFACE_ALT}
        polygonsTransitionDuration={0}
        onPolygonClick={(f: object) => {
          const code = (f as { properties: { __code?: string } }).properties.__code
          if (code) onPick({ kind: 'region', code })
        }}
        // --- trips (fat-line custom layer: constant screen width at every zoom) ---
        customLayerData={arcsData}
        customThreeObject={buildArc}
        // --- stays / airports (constant screen-size HTML markers) ---
        htmlElementsData={pointsData}
        htmlLat="lat"
        htmlLng="lng"
        htmlAltitude={SURFACE_ALT}
        htmlElement={htmlMarker}
        onZoom={(pov: { altitude: number }) => {
          const zi = pov.altitude < 1.3 // reveal US states once peering at a country
          setZoomedIn((cur) => (cur === zi ? cur : zi))
        }}
      />

      <div className="glass panel-shadow absolute bottom-4 right-4 flex flex-col overflow-hidden rounded-lg">
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
