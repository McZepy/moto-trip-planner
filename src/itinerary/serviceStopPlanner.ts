import type {
  TripRoutePlan,
} from '../providers/tripRoutePlanner'

import type {
  TripServiceStop,
} from '../types/serviceStop'

import {
  pointAtRoadDistance,
  roadDistanceMeters,
} from './routeDaySplitter'

export type PlannedRouteStopPoint = {
  routeKm: number
  point: {
    lat: number
    lng: number
  }
}

export function plannedStopPoints(
  plan:
    TripRoutePlan,
  intervalKm:
    number,
  minimumRemainingKm =
    40,
) {
  const totalKm =
    roadDistanceMeters(
      plan,
    ) /
    1000

  const safeInterval =
    Math.max(
      20,
      intervalKm,
    )

  const points:
    PlannedRouteStopPoint[] = []

  for (
    let target =
      safeInterval;
    target <
      totalKm -
        minimumRemainingKm;
    target +=
      safeInterval
  ) {
    const point =
      pointAtRoadDistance(
        plan,
        target *
          1000,
      )

    if (point) {
      points.push(
        point,
      )
    }
  }

  return points
}


export function routeSearchPoints(
  plan:
    TripRoutePlan,
  targetKm:
    number,
  spanKm =
    15,
) {
  const totalKm =
    roadDistanceMeters(
      plan,
    ) /
    1000

  return [
    targetKm,
    targetKm -
      spanKm,
    targetKm +
      spanKm,
  ]
    .filter(
      (
        km,
      ) =>
        km >
          0 &&
        km <
          totalKm,
    )
    .map(
      (
        km,
      ) =>
        pointAtRoadDistance(
          plan,
          km *
            1000,
        ),
    )
    .filter(
      (
        value,
      ): value is PlannedRouteStopPoint =>
        value !==
        null,
    )
}


function haversineKm(
  first: {
    lat: number
    lng: number
  },
  second: {
    lat: number
    lng: number
  },
) {
  const toRad =
    (
      value:
        number,
    ) =>
      value *
      Math.PI /
      180

  const earthRadiusKm =
    6371

  const lat1 =
    toRad(
      first.lat,
    )

  const lat2 =
    toRad(
      second.lat,
    )

  const deltaLat =
    toRad(
      second.lat -
      first.lat,
    )

  const deltaLng =
    toRad(
      second.lng -
      first.lng,
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
    earthRadiusKm *
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

function sameStopScope(
  stop:
    TripServiceStop,
  dayId:
    string | null,
) {
  return (
    stop.dayId ??
    null
  ) ===
    dayId
}

export function mergeFuelAndBreakStops(
  stops:
    TripServiceStop[],
  dayId:
    string | null,
  routeToleranceKm =
    20,
  directToleranceKm =
    12,
) {
  const cloned =
    stops.map(
      (
        stop,
      ) => ({
        ...stop,
      }),
    )

  const fuels =
    cloned.filter(
      (
        stop,
      ) =>
        stop.kind ===
          'fuel' &&
        sameStopScope(
          stop,
          dayId,
        ),
    )

  const breaks =
    cloned.filter(
      (
        stop,
      ) =>
        stop.kind ===
          'break' &&
        sameStopScope(
          stop,
          dayId,
        ),
    )

  const mergedBreakIds =
    new Set<string>()

  for (
    const pause
    of breaks
  ) {
    const candidate =
      fuels
        .map(
          (
            fuel,
          ) => {
            const routeGap =
              Math.abs(
                fuel.routeKm -
                pause.routeKm,
              )

            const directGap =
              haversineKm(
                fuel,
                pause,
              )

            const routeClose =
              routeGap <=
              routeToleranceKm

            const mapClose =
              directGap <=
                directToleranceKm &&
              routeGap <=
                routeToleranceKm *
                  2

            if (
              !routeClose &&
              !mapClose
            ) {
              return null
            }

            return {
              fuel,
              routeGap,
              directGap,
              score:
                routeGap +
                directGap *
                  2,
            }
          },
        )
        .filter(
          (
            value,
          ): value is {
            fuel:
              TripServiceStop
            routeGap:
              number
            directGap:
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
        )[0]

    if (!candidate) {
      continue
    }

    candidate.fuel.relaxMinutes =
      Math.max(
        candidate.fuel
          .relaxMinutes ??
          0,
        pause.durationMinutes ??
          15,
      )

    mergedBreakIds.add(
      pause.id,
    )
  }

  return {
    stops:
      cloned.filter(
        (
          stop,
        ) =>
          !mergedBreakIds.has(
            stop.id,
          ),
      ),

    mergedCount:
      mergedBreakIds.size,
  }
}
