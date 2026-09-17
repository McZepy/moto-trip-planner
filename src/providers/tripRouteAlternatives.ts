import type {
  RouteGeometry,
  RoutePoint,
} from './routingProvider'

import {
  osrmRoutingProvider,
} from './routingProvider'

import {
  findFerryCandidates,
  type FerryCandidate,
} from './ferryProvider'

import type {
  FerryRouteSection,
  RoadRouteSection,
  TripRoutePlan,
  TripRouteSection,
} from './tripRoutePlanner'

export type RouteAlternative = {
  id: string
  label: string

  kind:
    | 'road-only'
    | 'ferry'

  plan: TripRoutePlan

  ferryCandidate?:
    FerryCandidate
}

export type RouteAlternativesResult = {
  criterion: 'fastest'

  alternatives:
    RouteAlternative[]

  selected:
    RouteAlternative
}

const MIN_ROAD_SECTION_KM =
  1

function toRadians(
  value: number,
) {
  return (
    value *
    Math.PI /
    180
  )
}

function distanceKm(
  first: RoutePoint,
  second: RoutePoint,
) {
  const earthRadiusKm =
    6371

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
    Math.cos(firstLat) *
      Math.cos(secondLat) *
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

function summarizeSections(
  sections:
    TripRouteSection[],
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

function createFerryGeometry(
  candidate:
    FerryCandidate,
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

function createFerrySection(
  candidate:
    FerryCandidate,
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

async function buildRoadOnlyAlternative(
  start: RoutePoint,
  destination: RoutePoint,
): Promise<RouteAlternative> {
  const road =
    await createRoadSection(
      'road:direct',
      start,
      destination,
    )

  return {
    id:
      'road-only',

    label:
      'Tutto strada',

    kind:
      'road-only',

    plan:
      summarizeSections(
        [
          road,
        ],
      ),
  }
}

async function buildFerryAlternative(
  start: RoutePoint,
  destination: RoutePoint,
  candidate:
    FerryCandidate,
): Promise<RouteAlternative> {
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
        `road:approach:${candidate.connection.id}`,
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
        `road:exit:${candidate.connection.id}`,
        candidate
          .arrivalPort
          .point,
        destination,
      ),
    )
  }

  return {
    id:
      `ferry:${candidate.connection.id}`,

    label:
      `Traghetto ${candidate.departurePort.name} → ${candidate.arrivalPort.name}`,

    kind:
      'ferry',

    plan:
      summarizeSections(
        sections,
      ),

    ferryCandidate:
      candidate,
  }
}

export async function planFastestRouteAlternatives(
  start: RoutePoint,
  destination: RoutePoint,
  allowFerries: boolean,
): Promise<RouteAlternativesResult> {
  const alternatives:
    RouteAlternative[] = []

  alternatives.push(
    await buildRoadOnlyAlternative(
      start,
      destination,
    ),
  )

  if (allowFerries) {
    const candidates =
      findFerryCandidates(
        start,
        destination,
      )

    for (
      const candidate
      of candidates
    ) {
      alternatives.push(
        await buildFerryAlternative(
          start,
          destination,
          candidate,
        ),
      )
    }
  }

  alternatives.sort(
    (
      first,
      second,
    ) =>
      first.plan
        .durationSeconds -
      second.plan
        .durationSeconds,
  )

  const selected =
    alternatives[0]

  if (!selected) {
    throw new Error(
      'Nessuna alternativa di percorso disponibile.',
    )
  }

  return {
    criterion:
      'fastest',

    alternatives,

    selected,
  }
}
