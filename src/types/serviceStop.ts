export type ServiceStopKind =
  | 'fuel'
  | 'break'

export type TripServiceStop = {
  id: string
  kind: ServiceStopKind

  dayId?: string
  dayNumber?: number

  routeKm: number
  deviationKm?: number

  name: string
  label: string

  lat: number
  lng: number

  durationMinutes?: number
  relaxMinutes?: number

  source:
    | 'automatic'
    | 'manual'
    | 'locationiq'
}

export function cloneServiceStop(
  stop: TripServiceStop,
): TripServiceStop {
  return {
    ...stop,
  }
}
