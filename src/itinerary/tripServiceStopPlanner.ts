import {
  searchNearbyFuelStations,
  searchNearbyRestFacilities,
} from '../providers/autocompleteProvider'

import type {
  TripRoutePlan,
} from '../providers/tripRoutePlanner'

import {
  pointAtRoadDistance,
  roadDistanceMeters,
  roadKmAtPoint,
} from './routeDaySplitter'

import {
  mergeFuelAndBreakStops,
} from './serviceStopPlanner'

import type {
  TripDay,
} from '../types/tripDay'

import type {
  TripSettings,
} from '../types/trip'

import type {
  ServiceStopPlanningSettings,
  TripServiceStop,
} from '../types/serviceStop'

type RouteScope = {
  dayId?: string
  dayNumber?: number
  startKm: number
  endKm: number
}

export type ServiceStopPlanningResult = {
  stops: TripServiceStop[]
  warnings: string[]
  generatedCount: number
  mergedCount: number
}

type CommonPlanArgs = {
  routePlan: TripRoutePlan
  selectedDayId?: string | null
  days: TripDay[]
  stops: TripServiceStop[]
  planningSettings:
    ServiceStopPlanningSettings
}

type FuelPlanArgs =
  CommonPlanArgs & {
    tripSettings:
      TripSettings
  }

function createId(
  prefix:
    'fuel' | 'break',
) {
  if (
    typeof crypto !==
      'undefined' &&
    crypto.randomUUID
  ) {
    return crypto.randomUUID()
  }

  return (
    prefix +
    '-' +
    Date.now() +
    '-' +
    Math.random()
      .toString(16)
      .slice(2)
  )
}

function distanceMeters(
  a: {
    lat: number
    lng: number
  },
  b: {
    lat: number
    lng: number
  },
) {
  const toRad =
    (value: number) =>
      value *
      Math.PI /
      180

  const earthRadius =
    6_371_000

  const lat1 =
    toRad(
      a.lat,
    )

  const lat2 =
    toRad(
      b.lat,
    )

  const deltaLat =
    toRad(
      b.lat -
      a.lat,
    )

  const deltaLng =
    toRad(
      b.lng -
      a.lng,
    )

  const h =
    Math.sin(
      deltaLat /
      2,
    ) ** 2 +
    Math.cos(
      lat1,
    ) *
      Math.cos(
        lat2,
      ) *
      Math.sin(
        deltaLng /
        2,
      ) ** 2

  return (
    2 *
    earthRadius *
    Math.atan2(
      Math.sqrt(
        h,
      ),
      Math.sqrt(
        1 -
        h,
      ),
    )
  )
}

function stopInScope(
  stop:
    TripServiceStop,
  scope:
    RouteScope,
) {
  return (
    (
      stop.dayId ??
      null
    ) ===
      (
        scope.dayId ??
        null
      )
  )
}

function buildRouteScopes(
  routePlan:
    TripRoutePlan,
  selectedDayId:
    string | null | undefined,
  days:
    TripDay[],
): RouteScope[] {
  const totalKm =
    roadDistanceMeters(
      routePlan,
    ) /
    1000

  if (
    totalKm <=
    0
  ) {
    return []
  }

  if (
    selectedDayId
  ) {
    const day =
      days.find(
        (
          item,
        ) =>
          item.id ===
          selectedDayId,
      )

    return [
      {
        dayId:
          selectedDayId,
        dayNumber:
          day?.dayNumber,
        startKm:
          0,
        endKm:
          totalKm,
      },
    ]
  }

  if (
    days.length ===
    0
  ) {
    return [
      {
        startKm:
          0,
        endKm:
          totalKm,
      },
    ]
  }

  const scopes:
    RouteScope[] = []

  let cursor =
    0

  for (
    let index =
      0;
    index <
      days.length;
    index +=
      1
  ) {
    const day =
      days[
        index
      ]

    const last =
      index ===
      days.length -
        1

    let endKm =
      totalKm

    if (!last) {
      const destination =
        day.routingOverride
          ?.destinationPlace

      const projected =
        destination
          ? roadKmAtPoint(
              routePlan,
              destination,
            )
          : null

      const fallback =
        cursor +
        Math.max(
          1,
          (
            day
              .plannedDistanceMeters ??
            0
          ) /
            1000,
        )

      const candidate =
        projected !==
            null &&
        projected >
          cursor +
            1 &&
        projected <
          totalKm
          ? projected
          : fallback

      endKm =
        Math.max(
          cursor +
            1,
          Math.min(
            totalKm,
            candidate,
          ),
        )
    }

    scopes.push({
      dayId:
        day.id,
      dayNumber:
        day.dayNumber,
      startKm:
        cursor,
      endKm,
    })

    cursor =
      endKm
  }

  const lastScope =
    scopes.at(
      -1,
    )

  if (lastScope) {
    lastScope.endKm =
      totalKm
  }

  return scopes
}

function removeAffectedKind(
  stops:
    TripServiceStop[],
  kind:
    TripServiceStop['kind'],
  selectedDayId:
    string | null | undefined,
) {
  return stops.filter(
    (
      stop,
    ) => {
      if (
        stop.kind !==
        kind
      ) {
        return true
      }

      if (
        selectedDayId
      ) {
        return (
          stop.dayId !==
          selectedDayId
        )
      }

      return false
    },
  )
}

function reconcileScopes(
  stops:
    TripServiceStop[],
  scopes:
    RouteScope[],
  routeToleranceKm:
    number,
  directToleranceKm:
    number,
) {
  let current =
    stops

  let mergedCount =
    0

  for (
    const scope
    of scopes
  ) {
    const reconciled =
      mergeFuelAndBreakStops(
        current,
        scope.dayId ??
          null,
        routeToleranceKm,
        directToleranceKm,
      )

    current =
      reconciled.stops

    mergedCount +=
      reconciled.mergedCount
  }

  return {
    stops:
      current,
    mergedCount,
  }
}

export async function planBreakStopsForTrip({
  routePlan,
  selectedDayId,
  days,
  stops,
  planningSettings,
}: CommonPlanArgs): Promise<ServiceStopPlanningResult> {
  const scopes =
    buildRouteScopes(
      routePlan,
      selectedDayId,
      days,
    )

  const baseStops =
    removeAffectedKind(
      stops,
      'break',
      selectedDayId,
    ).map(
      (
        stop,
      ) =>
        stop.kind ===
          'fuel' &&
        (
          !selectedDayId ||
          stop.dayId ===
            selectedDayId
        )
          ? {
              ...stop,
              relaxMinutes:
                undefined,
            }
          : {
              ...stop,
            },
    )

  const generated:
    TripServiceStop[] = []

  const warnings:
    string[] = []

  let directMerged =
    0

  for (
    const scope
    of scopes
  ) {
    const fuelStops =
      baseStops.filter(
        (
          stop,
        ) =>
          stop.kind ===
            'fuel' &&
          stopInScope(
            stop,
            scope,
          ),
      )

    for (
      let targetKm =
        scope.startKm +
        planningSettings
          .breakIntervalKm;
      targetKm <
        scope.endKm -
          45;
      targetKm +=
        planningSettings
          .breakIntervalKm
    ) {
      const nearbyFuel =
        fuelStops
          .filter(
            (
              stop,
            ) =>
              Math.abs(
                stop.routeKm -
                targetKm,
              ) <=
              planningSettings
                .breakFlexibilityKm,
          )
          .sort(
            (
              first,
              second,
            ) =>
              Math.abs(
                first.routeKm -
                targetKm,
              ) -
              Math.abs(
                second.routeKm -
                targetKm,
              ),
          )[0]

      if (nearbyFuel) {
        nearbyFuel.relaxMinutes =
          planningSettings
            .breakDurationMinutes

        directMerged +=
          1

        continue
      }

      const target =
        pointAtRoadDistance(
          routePlan,
          targetKm *
            1000,
        )

      if (!target) {
        continue
      }

      const searchRadiusMeters =
        (
          planningSettings
            .breakFlexibilityKm +
          planningSettings
            .breakMaxDeviationKm +
          2
        ) *
        1000

      const candidates =
        await searchNearbyRestFacilities(
          target.point,
          searchRadiusMeters,
        )

      const ranked =
        candidates
          .map(
            (
              candidate,
            ) => {
              const routeKm =
                roadKmAtPoint(
                  routePlan,
                  candidate,
                )

              if (
                routeKm ===
                null
              ) {
                return null
              }

              const projected =
                pointAtRoadDistance(
                  routePlan,
                  routeKm *
                    1000,
                )

              if (!projected) {
                return null
              }

              const deviationKm =
                distanceMeters(
                  candidate,
                  projected.point,
                ) /
                1000

              const alongDifference =
                Math.abs(
                  routeKm -
                  targetKm,
                )

              if (
                routeKm <
                  scope.startKm ||
                routeKm >
                  scope.endKm ||
                alongDifference >
                  planningSettings
                    .breakFlexibilityKm ||
                deviationKm >
                  planningSettings
                    .breakMaxDeviationKm
              ) {
                return null
              }

              const preferredType =
                [
                  'services',
                  'cafe',
                  'restaurant',
                  'fast_food',
                ].includes(
                  candidate.type ??
                    '',
                )

              return {
                candidate,
                routeKm,
                deviationKm,
                score:
                  deviationKm *
                    12 +
                  alongDifference +
                  (
                    preferredType
                      ? 0
                      : 4
                  ),
              }
            },
          )
          .filter(
            (
              value,
            ): value is {
              candidate:
                typeof candidates[number]
              routeKm:
                number
              deviationKm:
                number
              score:
                number
            } =>
              value !==
              null,
          )
          .sort(
            (
              first,
              second,
            ) =>
              first.score -
              second.score,
          )

      const best =
        ranked[0]

      if (!best) {
        warnings.push(
          `Giorno ${scope.dayNumber ?? '—'} · km ${(targetKm - scope.startKm).toFixed(0)}: nessuna area servizi/caffè trovata nella finestra prevista.`,
        )

        continue
      }

      generated.push({
        id:
          createId(
            'break',
          ),
        kind:
          'break',
        dayId:
          scope.dayId,
        dayNumber:
          scope.dayNumber,
        routeKm:
          best.routeKm,
        deviationKm:
          best.deviationKm,
        name:
          best.candidate.name,
        label:
          best.candidate.label,
        lat:
          best.candidate.lat,
        lng:
          best.candidate.lng,
        durationMinutes:
          planningSettings
            .breakDurationMinutes,
        source:
          'locationiq',
      })
    }
  }

  const reconciled =
    reconcileScopes(
      [
        ...baseStops,
        ...generated,
      ],
      scopes,
      planningSettings
        .breakFlexibilityKm,
      Math.min(
        12,
        planningSettings
          .breakFlexibilityKm,
      ),
    )

  return {
    stops:
      reconciled.stops,
    warnings,
    generatedCount:
      generated.length,
    mergedCount:
      directMerged +
      reconciled.mergedCount,
  }
}

export async function planFuelStopsForTrip({
  routePlan,
  selectedDayId,
  days,
  stops,
  tripSettings,
  planningSettings,
}: FuelPlanArgs): Promise<ServiceStopPlanningResult> {
  const scopes =
    buildRouteScopes(
      routePlan,
      selectedDayId,
      days,
    )

  const baseStops =
    removeAffectedKind(
      stops,
      'fuel',
      selectedDayId,
    ).map(
      (
        stop,
      ) => ({
        ...stop,
      }),
    )

  const generated:
    TripServiceStop[] = []

  const warnings:
    string[] = []

  const safeFuelKm =
    Math.max(
      50,
      tripSettings
        .vehicleRangeKm -
        tripSettings
          .fuelSafetyMarginKm,
    )

  for (
    const scope
    of scopes
  ) {
    let previousFuelKm =
      scope.startKm

    let guard =
      0

    while (
      scope.endKm -
        previousFuelKm >
        tripSettings
          .vehicleRangeKm &&
      guard <
        30
    ) {
      guard +=
        1

      const earliestFuelKm =
        previousFuelKm +
        safeFuelKm

      const latestFuelKm =
        Math.min(
          scope.endKm,
          previousFuelKm +
            tripSettings
              .vehicleRangeKm,
        )

      const scopeBreaks =
        baseStops.filter(
          (
            stop,
          ) =>
            stop.kind ===
              'break' &&
            stopInScope(
              stop,
              scope,
            ),
        )

      const nearbyBreak =
        scopeBreaks
          .filter(
            (
              stop,
            ) =>
              stop.routeKm >=
                earliestFuelKm -
                  planningSettings
                    .fuelFlexibilityKm &&
              stop.routeKm <=
                latestFuelKm +
                  planningSettings
                    .fuelFlexibilityKm,
          )
          .sort(
            (
              first,
              second,
            ) =>
              Math.abs(
                first.routeKm -
                latestFuelKm,
              ) -
              Math.abs(
                second.routeKm -
                latestFuelKm,
              ),
          )[0]

      const preferredKm =
        Math.max(
          earliestFuelKm,
          Math.min(
            latestFuelKm,
            nearbyBreak
              ?.routeKm ??
              (
                latestFuelKm -
                Math.min(
                  10,
                  tripSettings
                    .fuelSafetyMarginKm /
                    2,
                )
              ),
          ),
        )

      const searchTargets =
        [
          preferredKm,
          earliestFuelKm,
          Math.max(
            earliestFuelKm,
            latestFuelKm -
              1,
          ),
        ].filter(
          (
            value,
            index,
            values,
          ) =>
            values.findIndex(
              (
                item,
              ) =>
                Math.abs(
                  item -
                  value,
                ) <
                0.5,
            ) ===
            index,
        )

      const candidateMap =
        new Map<
          string,
          Awaited<
            ReturnType<
              typeof searchNearbyFuelStations
            >
          >[number]
        >()

      const searchRadiusMeters =
        (
          planningSettings
            .fuelFlexibilityKm +
          planningSettings
            .fuelMaxDeviationKm +
          2
        ) *
        1000

      for (
        const searchKm
        of searchTargets
      ) {
        const target =
          pointAtRoadDistance(
            routePlan,
            searchKm *
              1000,
          )

        if (!target) {
          continue
        }

        const found =
          await searchNearbyFuelStations(
            target.point,
            searchRadiusMeters,
          )

        found.forEach(
          (
            candidate,
          ) =>
            candidateMap.set(
              candidate.id,
              candidate,
            ),
        )
      }

      const candidates =
        Array.from(
          candidateMap.values(),
        )

      const ranked =
        candidates
          .map(
            (
              candidate,
            ) => {
              const routeKm =
                roadKmAtPoint(
                  routePlan,
                  candidate,
                )

              if (
                routeKm ===
                null
              ) {
                return null
              }

              const projected =
                pointAtRoadDistance(
                  routePlan,
                  routeKm *
                    1000,
                )

              if (!projected) {
                return null
              }

              const deviationKm =
                distanceMeters(
                  candidate,
                  projected.point,
                ) /
                1000

              const alongDifference =
                Math.abs(
                  routeKm -
                  preferredKm,
                )

              if (
                routeKm <
                  scope.startKm ||
                routeKm >
                  scope.endKm ||
                routeKm <
                  earliestFuelKm -
                    planningSettings
                      .fuelFlexibilityKm ||
                routeKm >
                  latestFuelKm +
                    2 ||
                deviationKm >
                  planningSettings
                    .fuelMaxDeviationKm
              ) {
                return null
              }

              const breakDifference =
                nearbyBreak
                  ? Math.abs(
                      routeKm -
                      nearbyBreak.routeKm,
                    )
                  : alongDifference

              return {
                candidate,
                routeKm,
                deviationKm,
                score:
                  deviationKm *
                    12 +
                  breakDifference +
                  alongDifference *
                    0.35,
              }
            },
          )
          .filter(
            (
              value,
            ): value is {
              candidate:
                typeof candidates[number]
              routeKm:
                number
              deviationKm:
                number
              score:
                number
            } =>
              value !==
              null,
          )
          .sort(
            (
              first,
              second,
            ) =>
              first.score -
              second.score,
          )

      const best =
        ranked[0]

      if (!best) {
        warnings.push(
          `Giorno ${scope.dayNumber ?? '—'}: nessun distributore compatibile tra circa ${(earliestFuelKm - scope.startKm).toFixed(0)} e ${(latestFuelKm - scope.startKm).toFixed(0)} km dalla partenza/rifornimento precedente.`,
        )

        break
      }

      const segmentKm =
        Math.max(
          0,
          best.routeKm -
          previousFuelKm,
        )

      const estimatedCostEur =
        tripSettings
            .kmPerLiter &&
        tripSettings
            .fuelPricePerLiter
          ? (
              segmentKm /
              tripSettings
                .kmPerLiter
            ) *
            tripSettings
              .fuelPricePerLiter
          : undefined

      generated.push({
        id:
          createId(
            'fuel',
          ),
        kind:
          'fuel',
        dayId:
          scope.dayId,
        dayNumber:
          scope.dayNumber,
        routeKm:
          best.routeKm,
        deviationKm:
          best.deviationKm,
        name:
          best.candidate.name,
        label:
          best.candidate.label,
        lat:
          best.candidate.lat,
        lng:
          best.candidate.lng,
        durationMinutes:
          10,
        estimatedCostEur,
        source:
          'locationiq',
      })

      previousFuelKm =
        best.routeKm
    }
  }

  const reconciled =
    reconcileScopes(
      [
        ...baseStops,
        ...generated,
      ],
      scopes,
      Math.max(
        planningSettings
          .fuelFlexibilityKm,
        planningSettings
          .breakFlexibilityKm,
      ),
      Math.min(
        12,
        Math.max(
          planningSettings
            .fuelFlexibilityKm,
          planningSettings
            .breakFlexibilityKm,
        ),
      ),
    )

  return {
    stops:
      reconciled.stops,
    warnings,
    generatedCount:
      generated.length,
    mergedCount:
      reconciled.mergedCount,
  }
}

export async function replanAllTripServiceStops(
  routePlan:
    TripRoutePlan,
  days:
    TripDay[],
  tripSettings:
    TripSettings,
  planningSettings:
    ServiceStopPlanningSettings,
) {
  const breaks =
    await planBreakStopsForTrip({
      routePlan,
      selectedDayId:
        null,
      days,
      stops:
        [],
      planningSettings,
    })

  const fuel =
    await planFuelStopsForTrip({
      routePlan,
      selectedDayId:
        null,
      days,
      stops:
        breaks.stops,
      tripSettings,
      planningSettings,
    })

  return {
    stops:
      fuel.stops,
    warnings: [
      ...breaks.warnings,
      ...fuel.warnings,
    ],
    generatedCount:
      breaks.generatedCount +
      fuel.generatedCount,
    mergedCount:
      fuel.mergedCount,
  }
}
