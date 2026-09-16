import type { GeoBoundingBox } from '../providers/geocodingProvider'

export type WaypointType =
  | 'precise-stop'
  | 'zone-pass'
  | 'road-point'

export type Waypoint = {
  id: string

  type: WaypointType

  name: string
  label: string

  lat: number
  lng: number

  osmType?: string
  osmId?: number

  category?: string
  sourceType?: string

  boundingBox?: GeoBoundingBox
}

export const waypointTypeLabels: Record<
  WaypointType,
  string
> = {
  'precise-stop':
    'Sosta precisa',

  'zone-pass':
    'Passaggio zona',

  'road-point':
    'Punto strada',
}