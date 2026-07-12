// Loads the bundled geo index (airports + city gazetteer) once, as lazy chunks,
// and exposes it. Null while loading — callers render a light fallback.

import { useEffect, useState } from 'react'
import { type GeoIndex, loadGeoIndex } from '~/lib/geo'

export function useGeo(): GeoIndex | null {
  const [geo, setGeo] = useState<GeoIndex | null>(null)
  useEffect(() => {
    let alive = true
    loadGeoIndex().then((g) => {
      if (alive) setGeo(g)
    })
    return () => {
      alive = false
    }
  }, [])
  return geo
}
