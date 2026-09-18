import type {
  TripRoutePlan,
} from '../providers/tripRoutePlanner'

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
