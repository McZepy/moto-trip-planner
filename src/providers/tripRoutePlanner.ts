import type {
  RouteGeometry,
  RoutePoint,
} from './routingProvider'

import {
  osrmRoutingProvider,
} from './routingProvider'

import {
  proposeFerry,
  type FerryCandidate,
} from './ferryProvider'

export type RoadRouteSection = {
  id: string
  type: 'road'
  from: RoutePoint
  to: RoutePoint
  distanceMeters: number
  durationSeconds: number
  geometry: RouteGeometry
}

export type FerryRouteSection = {
  id: string
  type: 'ferry'
  from: RoutePoint
  to: RoutePoint
  distanceMeters: number
  durationSeconds: number
  geometry: RouteGeometry
  candidate: FerryCandidate
}

export type TripRouteSection =
  | RoadRouteSection
  | FerryRouteSection

export type TripRoutePlan = {
  sections: TripRouteSection[]
  distanceMeters: number
  durationSeconds: number
  usesFerry: boolean
}

const MIN_ROAD_SECTION_KM =
  1

function distanceKm(
  first: RoutePoint,
  second: RoutePoint,
) {
  const earthRadiusKm =
    6371

  const toRadians = (
    value: number,
  ) =>
    (
      value *
      Math.PI
    ) /
    180

  const deltaLat =
    toRadians(
      second.lat -
        first.lat,
    )

  const deltaLng =
    toRadians(
      second.lng -
        first.lng,
    )

  const firstLat =
    toRadians(
      first.lat,
    )

  const secondLat =
    toRadians(
      second.lat,
    )

  const a =
    Math.sin(
      deltaLat / 2,
    ) ** 2 +
    Math.cos(
      firstLat,
    ) *
      Math.cos(
        secondLat,
      ) *
      Math.sin(
        deltaLng / 2,
      ) ** 2

  return (
    earthRadiusKm *
    2 *
    Math.atan2(
      Math.sqrt(a),
      Math.sqrt(
        1 - a,
      ),
    )
  )
}

function createFerryGeometry(
  candidate: FerryCandidate,
): RouteGeometry {
  return {
    type: 'LineString',
    coordinates: [
      [
        candidate
          .departurePort
          .point
          .lng,

        candidate
          .departurePort
          .point
          .lat,
      ],

      [
        candidate
          .arrivalPort
          .point
          .lng,

        candidate
          .arrivalPort
          .point
          .lat,
      ],
    ],
  }
}

async function createRoadSection(
  id: string,
  from: RoutePoint,
  to: RoutePoint,
): Promise<RoadRouteSection> {
  const route =
    await osrmRoutingProvider
      .calculateRoute(
        [
          from,
          to,
        ],
      )

  return {
    id,
    type: 'road',
    from,
    to,
    distanceMeters:
      route.distanceMeters,
    durationSeconds:
      route.durationSeconds,
    geometry:
      route.geometry,
  }
}

function createFerrySection(
  candidate: FerryCandidate,
): FerryRouteSection {
  return {
    id:
      `ferry:${candidate.connection.id}`,

    type: 'ferry',

    from:
      candidate
        .departurePort
        .point,

    to:
      candidate
        .arrivalPort
        .point,

    distanceMeters:
      candidate
        .connection
        .distanceKm *
      1000,

    durationSeconds:
      candidate
        .connection
        .durationMinutes *
      60,

    geometry:
      createFerryGeometry(
        candidate,
      ),

    candidate,
  }
}

function summarizeSections(
  sections: TripRouteSection[],
): TripRoutePlan {
  return {
    sections,

    distanceMeters:
      sections.reduce(
        (
          total,
          section,
        ) =>
          total +
          section
            .distanceMeters,
        0,
      ),

    durationSeconds:
      sections.reduce(
        (
          total,
          section,
        ) =>
          total +
          section
            .durationSeconds,
        0,
      ),

    usesFerry:
      sections.some(
        (section) =>
          section.type ===
          'ferry',
      ),
  }
}

export async function planTripRoute(
  start: RoutePoint,
  destination: RoutePoint,
  allowFerries: boolean,
): Promise<TripRoutePlan> {
  const proposal =
    proposeFerry(
      start,
      destination,
      allowFerries,
    )

  if (
    proposal.type ===
    'road'
  ) {
    const road =
      await createRoadSection(
        'road:direct',
        start,
        destination,
      )

    return summarizeSections(
      [
        road,
      ],
    )
  }

  const {
    candidate,
  } = proposal

  const sections:
    TripRouteSection[] = []

  if (
    distanceKm(
      start,
      candidate
        .departurePort
        .point,
    ) >=
    MIN_ROAD_SECTION_KM
  ) {
    sections.push(
      await createRoadSection(
        'road:approach',
        start,
        candidate
          .departurePort
          .point,
      ),
    )
  }

  sections.push(
    createFerrySection(
      candidate,
    ),
  )

  if (
    distanceKm(
      candidate
        .arrivalPort
        .point,
      destination,
    ) >=
    MIN_ROAD_SECTION_KM
  ) {
    sections.push(
      await createRoadSection(
        'road:exit',
        candidate
          .arrivalPort
          .point,
        destination,
      ),
    )
  }

  return summarizeSections(
    sections,
  )
}
