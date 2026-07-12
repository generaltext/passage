// Trip-type iconography, shared by the log, dialogs, and inspector so a drive
// always looks like a drive.

import { Plane, Train, Car, Ship, Bus, MapPin } from 'lucide-react'
import type { TripType } from '~/lib/types'

const MAP: Record<TripType, React.ComponentType<{ size?: number }>> = {
  flight: Plane,
  train: Train,
  drive: Car,
  ferry: Ship,
  bus: Bus,
  other: MapPin,
}

export function TripTypeIcon({ type, size = 15 }: { type: TripType; size?: number }) {
  const C = MAP[type] ?? MapPin
  return <C size={size} />
}

export const ARRIVE_LABELS: Record<TripType, string> = {
  flight: 'A flight',
  train: 'A train',
  drive: 'A drive',
  ferry: 'A ferry',
  bus: 'A bus ride',
  other: 'A trip',
}
