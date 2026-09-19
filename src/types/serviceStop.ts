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
  estimatedCostEur?: number

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


export type ServiceStopPlanningSettings = {
  fuelFlexibilityKm: number
  fuelMaxDeviationKm: number
  breakIntervalKm: number
  breakDurationMinutes: number
  breakFlexibilityKm: number
  breakMaxDeviationKm: number
}

export const defaultServiceStopPlanningSettings:
  ServiceStopPlanningSettings = {
    fuelFlexibilityKm: 20,
    fuelMaxDeviationKm: 2,
    breakIntervalKm: 150,
    breakDurationMinutes: 15,
    breakFlexibilityKm: 20,
    breakMaxDeviationKm: 2,
  }

export function cloneServiceStopPlanningSettings(
  settings:
    ServiceStopPlanningSettings,
): ServiceStopPlanningSettings {
  return {
    ...settings,
  }
}
