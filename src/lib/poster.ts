// Poster rendering — the travel map composed as a print-style artwork on a flat
// canvas (d3-geo, not the 3D globe). One pure renderer drives both the on-screen
// preview and the high-res PNG export, so the download matches the preview.

import { geoEqualEarth, geoGraticule10, geoInterpolate, geoNaturalEarth1, geoPath, type GeoProjection } from 'd3-geo'
import { COUNTRY_FEATS, featuresForCode } from '~/lib/features'

export interface PosterTheme {
  name: string
  bg: string
  fg: string
  land: string // unvisited land fill
  base: string // coastline / faint stroke
  grid: string // graticule
}

export const POSTER_THEMES: PosterTheme[] = [
  { name: 'Midnight', bg: '#0b1220', fg: '#eaf1f7', land: '#1a2434', base: '#2c3947', grid: 'rgba(150,168,220,0.10)' },
  { name: 'Parchment', bg: '#e9dfc9', fg: '#3a2e1c', land: '#ece0c2', base: '#b6a079', grid: 'rgba(96,74,49,0.14)' },
  { name: 'Sea', bg: '#cfe0ea', fg: '#15202a', land: '#fbfdff', base: '#9db4c6', grid: 'rgba(21,32,42,0.08)' },
  { name: 'Noir', bg: '#0a0a0b', fg: '#f4f4f4', land: '#17171a', base: '#33333a', grid: 'rgba(244,244,244,0.06)' },
]

export type PosterProjection = 'naturalEarth' | 'equalEarth'

/** one visited region: a single colour fills solid, several become a hatch */
export interface PosterRegion { code: string; colors: string[] }
export interface PosterArc { fromLat: number; fromLon: number; toLat: number; toLon: number; color: string }
export interface PosterPoint { lat: number; lon: number; color: string; stay: boolean }

export interface PosterOptions {
  title: string
  subtitle: string
  theme: PosterTheme
  projection: PosterProjection
  showLand: boolean
  showGraticule: boolean
  showArcs: boolean
  showPoints: boolean
  showCaption: boolean
  regions: PosterRegion[]
  arcs: PosterArc[]
  points: PosterPoint[]
  thickness: number
}

// sample a great circle into a polyline so geoPath draws it as a curved route
function greatCircle(a: PosterArc): { type: 'LineString'; coordinates: [number, number][] } {
  const interp = geoInterpolate([a.fromLon, a.fromLat], [a.toLon, a.toLat])
  const n = 48
  const coordinates: [number, number][] = []
  for (let i = 0; i <= n; i++) coordinates.push(interp(i / n) as [number, number])
  return { type: 'LineString', coordinates }
}

export function drawPoster(ctx: CanvasRenderingContext2D, w: number, h: number, o: PosterOptions): void {
  const t = o.theme
  ctx.save()
  ctx.fillStyle = t.bg
  ctx.fillRect(0, 0, w, h)

  const padX = w * 0.06
  const padTop = h * 0.065
  const padBottom = h * 0.085 // a slim bottom margin for the faint caption
  const base: GeoProjection = o.projection === 'equalEarth' ? geoEqualEarth() : geoNaturalEarth1()
  const projection = base.fitExtent(
    [
      [padX, padTop],
      [w - padX, h - padBottom],
    ],
    { type: 'Sphere' },
  )
  const path = geoPath(projection, ctx)
  const unit = Math.max(w, h) / 1100 // scales weights with poster size
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'

  if (o.showGraticule) {
    ctx.beginPath()
    path(geoGraticule10())
    ctx.strokeStyle = t.grid
    ctx.lineWidth = 0.5 * unit
    ctx.stroke()
  }

  if (o.showLand) {
    ctx.beginPath()
    for (const f of COUNTRY_FEATS) path(f as never)
    ctx.fillStyle = t.land
    ctx.fill()
  }

  // visited regions — solids grouped by colour (one fill each), hatches drawn per region
  const solidByColor = new Map<string, unknown[]>()
  for (const r of o.regions) {
    const feats = featuresForCode(r.code)
    if (!feats.length) continue
    if (r.colors.length <= 1) {
      const color = r.colors[0] ?? t.base
      const arr = solidByColor.get(color) ?? []
      for (const f of feats) arr.push(f)
      solidByColor.set(color, arr)
    } else {
      for (const f of feats) hatchRegion(ctx, path, f, r.colors, unit, w, h)
    }
  }
  for (const [color, fs] of solidByColor) {
    ctx.beginPath()
    for (const f of fs) path(f as never)
    ctx.fillStyle = color
    ctx.fill()
  }

  // crisp coastlines over the fills
  if (o.showLand) {
    ctx.beginPath()
    for (const f of COUNTRY_FEATS) path(f as never)
    ctx.strokeStyle = t.base
    ctx.lineWidth = 0.4 * unit
    ctx.globalAlpha = 0.8
    ctx.stroke()
    ctx.globalAlpha = 1
  }

  if (o.showArcs) {
    for (const a of o.arcs) {
      ctx.beginPath()
      path(greatCircle(a))
      ctx.strokeStyle = a.color
      ctx.globalAlpha = 0.85
      ctx.lineWidth = 1.1 * unit * o.thickness
      ctx.stroke()
    }
    ctx.globalAlpha = 1
  }

  if (o.showPoints) {
    for (const p of o.points) {
      const xy = projection([p.lon, p.lat])
      if (!xy) continue
      ctx.beginPath()
      ctx.arc(xy[0], xy[1], (p.stay ? 3.2 : 2.4) * unit * o.thickness, 0, Math.PI * 2)
      ctx.fillStyle = p.color
      ctx.fill()
      ctx.lineWidth = 1 * unit
      ctx.strokeStyle = t.bg
      ctx.stroke()
    }
  }

  // a small, faint caption at the bottom — optional
  if (o.showCaption) {
    const parts = [o.title.trim(), o.subtitle.trim()].filter(Boolean)
    if (parts.length) {
      const size = Math.round(h * 0.023)
      ctx.font = `500 ${size}px "Iowan Old Style", Palatino, Georgia, serif`
      ctx.textBaseline = 'alphabetic'
      ctx.textAlign = 'left'
      ctx.fillStyle = t.fg
      ctx.globalAlpha = 0.5
      ctx.fillText(parts.join('   ·   '), padX, h - padBottom * 0.45)
      ctx.globalAlpha = 1
    }
  }
  ctx.restore()
}

// diagonal hatch of several colours, clipped to a region — mirrors the globe's
// multi-person fill. Uses ONE global stripe field (same origin/angle for every
// region) so hatches line up across the map and large multi-island countries
// don't drift out of phase.
function hatchRegion(ctx: CanvasRenderingContext2D, path: ReturnType<typeof geoPath>, feature: unknown, colors: string[], unit: number, w: number, h: number): void {
  const b = path.bounds(feature as never) as [[number, number], [number, number]]
  if (!isFinite(b[0][0]) || b[1][0] - b[0][0] < 0.5) return
  const stripe = Math.max(6, 9 * unit)
  const R = w + h
  ctx.save()
  ctx.beginPath()
  path(feature as never)
  ctx.clip()
  ctx.translate(w / 2, h / 2)
  ctx.rotate(Math.PI / 4)
  for (let x = -R, i = Math.round(-R / stripe); x < R; x += stripe, i++) {
    ctx.fillStyle = colors[((i % colors.length) + colors.length) % colors.length]!
    ctx.fillRect(x, -R, stripe + 0.6, 2 * R)
  }
  ctx.restore()
}
