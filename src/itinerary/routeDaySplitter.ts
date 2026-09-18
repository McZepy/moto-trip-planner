import type {
  GeocodingResult,
} from '../providers/geocodingProvider'

import type {
  TripRoutePlan,
  TripRouteSection,
} from '../providers/tripRoutePlanner'

export type RouteBreakPoint = {
  routeKm: number
  point: {
    lat: number
    lng: number
  }
}

export type RouteBreakCandidate =
  RouteBreakPoint & {
    place?: GeocodingResult
  }

type WeightedSegment = {
  from: {
    lat: number
    lng: number
  }
  to: {
    lat: number
    lng: number
  }
  startMeters: number
  endMeters: number
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
      (
        value *
        Math.PI
      ) /
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

function roadSections(
  plan: TripRoutePlan,
) {
  return plan.sections.filter(
    (
      section,
    ): section is Extract<
      TripRouteSection,
      { type: 'road' }
    > =>
      section.type ===
      'road',
  )
}

export function roadDistanceMeters(
  plan: TripRoutePlan,
) {
  return roadSections(
    plan,
  ).reduce(
    (
      total,
      section,
    ) => {
      const ferryMeters =
        (
          section
            .embeddedFerries ??
          []
        ).reduce(
          (
            subtotal,
            ferry,
          ) =>
            subtotal +
            ferry
              .distanceMeters,
          0,
        )

      return (
        total +
        Math.max(
          0,
          section
            .distanceMeters -
            ferryMeters,
        )
      )
    },
    0,
  )
}

function weightedSegmentsForSection(
  section:
    TripRouteSection,
  routeStartMeters:
    number,
) {
  const coordinates =
    section.geometry
      .coordinates

  if (
    coordinates.length <
    2
  ) {
    return {
      segments:
        [] as WeightedSegment[],

      routeEndMeters:
        routeStartMeters,
    }
  }

  const ferryRanges =
    section.type ===
      'road'
      ? section
          .embeddedFerries ??
        []
      : []

  const raw =
    coordinates
      .slice(
        0,
        -1,
      )
      .map(
        (
          coordinate,
          index,
        ) => {
          const next =
            coordinates[
              index +
              1
            ]

          const from = {
            lng:
              coordinate[0],
            lat:
              coordinate[1],
          }

          const to = {
            lng:
              next[0],
            lat:
              next[1],
          }

          const onFerry =
            ferryRanges.some(
              (
                ferry,
              ) =>
                index >=
                  ferry.startPointIndex &&
                index <
                  ferry.endPointIndex,
            )

          return {
            from,
            to,
            index,
            onFerry,
            rawMeters:
              distanceMeters(
                from,
                to,
              ),
          }
        },
      )

  const rawTotal =
    raw.reduce(
      (
        total,
        segment,
      ) =>
        total +
        segment.rawMeters,
      0,
    )

  if (
    rawTotal <=
    0
  ) {
    return {
      segments:
        [] as WeightedSegment[],

      routeEndMeters:
        routeStartMeters,
    }
  }

  let current =
    routeStartMeters

  const segments:
    WeightedSegment[] = []

  for (
    const segment
    of raw
  ) {
    const weighted =
      section
        .distanceMeters *
      (
        segment
          .rawMeters /
        rawTotal
      )

    if (
      segment.onFerry
    ) {
      continue
    }

    const item:
      WeightedSegment = {
      from:
        segment.from,

      to:
        segment.to,

      startMeters:
        current,

      endMeters:
        current +
        weighted,
    }

    current =
      item.endMeters

    segments.push(
      item,
    )
  }

  return {
    segments,

    routeEndMeters:
      current,
  }
}

function buildWeightedRoadSegments(
  plan: TripRoutePlan,
) {
  const segments:
    WeightedSegment[] = []

  let current =
    0

  for (
    const section
    of roadSections(
      plan,
    )
  ) {
    const weighted =
      weightedSegmentsForSection(
        section,
        current,
      )

    segments.push(
      ...weighted.segments,
    )

    current =
      weighted
        .routeEndMeters
  }

  return {
    segments,
    totalMeters:
      current,
  }
}

export function pointAtRoadDistance(
  plan:
    TripRoutePlan,
  targetMeters:
    number,
): RouteBreakPoint | null {
  const {
    segments,
    totalMeters,
  } =
    buildWeightedRoadSegments(
      plan,
    )

  if (
    segments.length ===
    0
  ) {
    return null
  }

  const safeTarget =
    Math.max(
      0,
      Math.min(
        targetMeters,
        totalMeters,
      ),
    )

  const segment =
    segments.find(
      (
        item,
      ) =>
        safeTarget <=
        item.endMeters,
    ) ??
    segments.at(-1)

  if (!segment) {
    return null
  }

  const span =
    Math.max(
      1,
      segment.endMeters -
      segment.startMeters,
    )

  const ratio =
    Math.max(
      0,
      Math.min(
        1,
        (
          safeTarget -
          segment.startMeters
        ) /
        span,
      ),
    )

  return {
    routeKm:
      safeTarget /
      1000,

    point: {
      lat:
        segment
          .from
          .lat +
        (
          segment
            .to
            .lat -
          segment
            .from
            .lat
        ) *
          ratio,

      lng:
        segment
          .from
          .lng +
        (
          segment
            .to
            .lng -
          segment
            .from
            .lng
        ) *
          ratio,
    },
  }
}

function projectedPointRatio(
  point: {
    lat: number
    lng: number
  },
  from: {
    lat: number
    lng: number
  },
  to: {
    lat: number
    lng: number
  },
) {
  const referenceLat =
    (
      from.lat +
      to.lat +
      point.lat
    ) /
    3

  const lngScale =
    Math.cos(
      referenceLat *
      Math.PI /
      180,
    )

  const ax =
    from.lng *
    lngScale

  const ay =
    from.lat

  const bx =
    to.lng *
    lngScale

  const by =
    to.lat

  const px =
    point.lng *
    lngScale

  const py =
    point.lat

  const dx =
    bx -
    ax

  const dy =
    by -
    ay

  const lengthSquared =
    dx *
    dx +
    dy *
    dy

  if (
    lengthSquared <=
    0
  ) {
    return {
      ratio:
        0,
      distanceSquared:
        (
          px -
          ax
        ) ** 2 +
        (
          py -
          ay
        ) ** 2,
    }
  }

  const ratio =
    Math.max(
      0,
      Math.min(
        1,
        (
          (
            px -
            ax
          ) *
            dx +
          (
            py -
            ay
          ) *
            dy
        ) /
          lengthSquared,
      ),
    )

  const projectedX =
    ax +
    dx *
      ratio

  const projectedY =
    ay +
    dy *
      ratio

  return {
    ratio,

    distanceSquared:
      (
        px -
        projectedX
      ) ** 2 +
      (
        py -
        projectedY
      ) ** 2,
  }
}

export function roadKmAtPoint(
  plan:
    TripRoutePlan,
  point: {
    lat: number
    lng: number
  },
) {
  const {
    segments,
  } =
    buildWeightedRoadSegments(
      plan,
    )

  if (
    segments.length ===
    0
  ) {
    return null
  }

  let best:
    {
      distanceSquared:
        number

      routeMeters:
        number
    } | null =
    null

  for (
    const segment
    of segments
  ) {
    const projection =
      projectedPointRatio(
        point,
        segment.from,
        segment.to,
      )

    const routeMeters =
      segment.startMeters +
      (
        segment.endMeters -
        segment.startMeters
      ) *
        projection.ratio

    if (
      !best ||
      projection.distanceSquared <
        best.distanceSquared
    ) {
      best = {
        distanceSquared:
          projection.distanceSquared,

        routeMeters,
      }
    }
  }

  return best
    ? best.routeMeters /
        1000
    : null
}

export function candidateRoadDistances(
  targetKm: number,
  toleranceKm:
    number,
) {
  return [
    targetKm -
      toleranceKm,
    targetKm,
    targetKm +
      toleranceKm,
  ]
    .filter(
      (
        value,
      ) =>
        value >
        0,
    )
    .map(
      (
        value,
      ) =>
        Math.round(
          value *
          10,
        ) /
        10,
    )
    .filter(
      (
        value,
        index,
        values,
      ) =>
        values.indexOf(
          value,
        ) ===
        index,
    )
}

export function routeBreakCandidates(
  plan:
    TripRoutePlan,
  cumulativeTargetKm:
    number,
  toleranceKm:
    number,
) {
  const totalKm =
    roadDistanceMeters(
      plan,
    ) /
    1000

  return candidateRoadDistances(
    cumulativeTargetKm,
    toleranceKm,
  )
    .filter(
      (
        km,
      ) =>
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
      ): value is RouteBreakPoint =>
        value !==
        null,
    )
}

export function cumulativeTargetsKm(
  dayTargetsKm:
    number[],
) {
  const targets:
    number[] = []

  let total =
    0

  for (
    let index =
      0;
    index <
      dayTargetsKm.length -
        1;
    index +=
      1
  ) {
    total +=
      Math.max(
        0,
        dayTargetsKm[
          index
        ] ??
          0,
      )

    targets.push(
      total,
    )
  }

  return targets
}
