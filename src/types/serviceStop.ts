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


export function orderedServiceStops(
  stops:
    TripServiceStop[],
) {
  return stops
    .slice()
    .sort(
      (
        first,
        second,
      ) => {
        const firstDay =
          first.dayNumber ??
          999

        const secondDay =
          second.dayNumber ??
          999

        if (
          firstDay !==
          secondDay
        ) {
          return (
            firstDay -
            secondDay
          )
        }

        return (
          first.routeKm -
          second.routeKm
        )
      },
    )
}

export function serviceStopBadgeLabel(
  orderedStops:
    TripServiceStop[],
  index:
    number,
) {
  const stop =
    orderedStops[
      index
    ]

  if (!stop) {
    return ''
  }

  const sameKindBefore =
    orderedStops
      .slice(
        0,
        index,
      )
      .filter(
        (
          item,
        ) =>
          item.kind ===
          stop.kind,
      )
      .length

  if (
    stop.kind ===
      'fuel'
  ) {
    return stop.relaxMinutes
      ? 'F+P'
      : `F${sameKindBefore + 1}`
  }

  return `P${sameKindBefore + 1}`
}
