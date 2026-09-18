import type {
  RouteEmbeddedFerry,
  RouteGeometry,
  RoutePoint,
  RouteResult,
  RoutingProvider,
} from '../providers/routingProvider'

import {
  osrmRoutingProvider,
} from '../providers/routingProvider'

import {
  findFerryCandidates,
  geoDistanceKm,
  type FerryCandidate,
  type FerryCandidateFinderOptions,
} from './ferryCandidateFinder'

import {
  resolveFerryServiceTiming,
  type FerryResolvedTiming,
} from './ferryVerifiedOverrides'

export type EvaluatedRoadSection = {
  id: string
  type: 'road'

  from: RoutePoint
  to: RoutePoint

  distanceMeters: number
  durationSeconds: number
  geometry: RouteGeometry
  embeddedFerries?: RouteEmbeddedFerry[]
}

export type EvaluatedFerrySection = {
  id: string
  type: 'ferry'

  from: RoutePoint
  to: RoutePoint

  distanceMeters: number
  durationSeconds: number
  geometry: RouteGeometry

  operator: string
  routeId: string
  serviceId: string

  timing:
    FerryResolvedTiming
}

export type EvaluatedRouteSection =
  | EvaluatedRoadSection
  | EvaluatedFerrySection

export type EvaluatedRouteAlternative = {
  id: string
  label: string

  kind:
    | 'direct-osrm'
    | 'known-ferry'

  sections:
    EvaluatedRouteSection[]

  distanceMeters: number
  durationSeconds: number

  ferryCandidate?:
    FerryCandidate
}

export type RejectedFerryCandidate = {
  serviceId: string
  routeId: string
  label: string
  reason: string
}

export type FerryRouteEvaluationResult = {
  criterion:
    'fastest-static'

  alternatives:
    EvaluatedRouteAlternative[]

  selected:
    EvaluatedRouteAlternative

  rejectedCandidates:
    RejectedFerryCandidate[]
}

export type FerryRouteEvaluatorOptions = {
  includeKnownFerries?: boolean

  candidateFinder?:
    FerryCandidateFinderOptions

  routingProvider?:
    RoutingProvider
}

const MIN_ROAD_SECTION_KM =
  1

function routePointKey(
  point: RoutePoint,
) {
  return (
    `${point.lat.toFixed(6)},` +
    `${point.lng.toFixed(6)}`
  )
}

function routeCacheKey(
  from: RoutePoint,
  to: RoutePoint,
) {
  return (
    routePointKey(from) +
    '->' +
    routePointKey(to)
  )
}

function summarizeSections(
  sections:
    EvaluatedRouteSection[],
) {
  return {
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
  }
}

function ferryGeometry(
  candidate:
    FerryCandidate,
): RouteGeometry {
  return {
    type: 'LineString',

    coordinates: [
      [
        candidate
          .departurePoint
          .lng,
        candidate
          .departurePoint
          .lat,
      ],

      [
        candidate
          .arrivalPoint
          .lng,
        candidate
          .arrivalPoint
          .lat,
      ],
    ],
  }
}

function createFerrySection(
  candidate:
    FerryCandidate,
  timing:
    FerryResolvedTiming,
): EvaluatedFerrySection {
  const route =
    candidate
      .serviceView
      .route

  const service =
    candidate
      .serviceView
      .service

  const distanceKm =
    route.distanceKm ??
    geoDistanceKm(
      candidate
        .departurePoint,
      candidate
        .arrivalPoint,
    )

  return {
    id:
      `ferry:${service.id}:${candidate.direction}`,

    type: 'ferry',

    from:
      candidate
        .departurePoint,

    to:
      candidate
        .arrivalPoint,

    distanceMeters:
      distanceKm *
      1000,

    durationSeconds:
      timing
        .comparisonMinutes *
      60,

    geometry:
      ferryGeometry(
        candidate,
      ),

    operator:
      service.operator,

    routeId:
      route.id,

    serviceId:
      service.id,

    timing,
  }
}

function roadSectionFromResult(
  id: string,
  from: RoutePoint,
  to: RoutePoint,
  result: RouteResult,
): EvaluatedRoadSection {
  return {
    id,
    type: 'road',

    from,
    to,

    distanceMeters:
      result.distanceMeters,

    durationSeconds:
      result.durationSeconds,

    geometry:
      result.geometry,

    embeddedFerries:
      result.embeddedFerries,
  }
}

async function buildFerryAlternative(
  start: RoutePoint,
  destination: RoutePoint,
  candidate:
    FerryCandidate,
  timing:
    FerryResolvedTiming,
  getRoadRoute: (
    from: RoutePoint,
    to: RoutePoint,
  ) => Promise<RouteResult>,
): Promise<EvaluatedRouteAlternative> {
  const sections:
    EvaluatedRouteSection[] = []

  const service =
    candidate
      .serviceView
      .service

  if (
    geoDistanceKm(
      start,
      candidate
        .departurePoint,
    ) >=
    MIN_ROAD_SECTION_KM
  ) {
    const result =
      await getRoadRoute(
        start,
        candidate
          .departurePoint,
      )

    sections.push(
      roadSectionFromResult(
        `road:approach:${service.id}`,
        start,
        candidate
          .departurePoint,
        result,
      ),
    )
  }

  sections.push(
    createFerrySection(
      candidate,
      timing,
    ),
  )

  if (
    geoDistanceKm(
      candidate
        .arrivalPoint,
      destination,
    ) >=
    MIN_ROAD_SECTION_KM
  ) {
    const result =
      await getRoadRoute(
        candidate
          .arrivalPoint,
        destination,
      )

    sections.push(
      roadSectionFromResult(
        `road:exit:${service.id}`,
        candidate
          .arrivalPoint,
        destination,
        result,
      ),
    )
  }

  const summary =
    summarizeSections(
      sections,
    )

  return {
    id:
      `known-ferry:${service.id}:${candidate.direction}`,

    label:
      `${service.operator}: ` +
      `${candidate.departurePortName} → ` +
      `${candidate.arrivalPortName}`,

    kind:
      'known-ferry',

    sections,

    distanceMeters:
      summary.distanceMeters,

    durationSeconds:
      summary.durationSeconds,

    ferryCandidate:
      candidate,
  }
}

function rejectionLabel(
  candidate:
    FerryCandidate,
) {
  return (
    `${candidate.serviceView.service.operator}: ` +
    `${candidate.departurePortName} → ` +
    `${candidate.arrivalPortName}`
  )
}

export async function evaluateFerryRouteAlternatives(
  start: RoutePoint,
  destination: RoutePoint,
  options:
    FerryRouteEvaluatorOptions =
      {},
): Promise<FerryRouteEvaluationResult> {
  const routingProvider =
    options.routingProvider ??
    osrmRoutingProvider

  const includeKnownFerries =
    options.includeKnownFerries ??
    true

  const cache =
    new Map<
      string,
      Promise<RouteResult>
    >()

  const getRoadRoute = (
    from: RoutePoint,
    to: RoutePoint,
  ) => {
    const key =
      routeCacheKey(
        from,
        to,
      )

    const cached =
      cache.get(key)

    if (cached) {
      return cached
    }

    const request =
      routingProvider
        .calculateRoute(
          [
            from,
            to,
          ],
        )

    cache.set(
      key,
      request,
    )

    return request
  }

  const directResult =
    await getRoadRoute(
      start,
      destination,
    )

  const directSection =
    roadSectionFromResult(
      'road:direct-osrm',
      start,
      destination,
      directResult,
    )

  const alternatives:
    EvaluatedRouteAlternative[] = [
      {
        id:
          'direct-osrm',

        label:
          'Percorso diretto OSRM',

        kind:
          'direct-osrm',

        sections: [
          directSection,
        ],

        distanceMeters:
          directResult
            .distanceMeters,

        durationSeconds:
          directResult
            .durationSeconds,
      },
    ]

  const rejectedCandidates:
    RejectedFerryCandidate[] = []

  if (includeKnownFerries) {
    const candidates =
      findFerryCandidates(
        start,
        destination,
        options.candidateFinder,
      )

    for (
      const candidate
      of candidates
    ) {
      const service =
        candidate
          .serviceView
          .service

      const timing =
        resolveFerryServiceTiming(
          service,
        )

      if (!timing) {
        rejectedCandidates.push({
          serviceId:
            service.id,

          routeId:
            candidate
              .serviceView
              .route
              .id,

          label:
            rejectionLabel(
              candidate,
            ),

          reason:
            'Durata statica non disponibile: alternativa non confrontabile.',
        })

        continue
      }

      try {
        alternatives.push(
          await buildFerryAlternative(
            start,
            destination,
            candidate,
            timing,
            getRoadRoute,
          ),
        )
      } catch (error) {
        rejectedCandidates.push({
          serviceId:
            service.id,

          routeId:
            candidate
              .serviceView
              .route
              .id,

          label:
            rejectionLabel(
              candidate,
            ),

          reason:
            error instanceof Error
              ? error.message
              : 'Errore OSRM durante la valutazione.',
        })
      }
    }
  }

  alternatives.sort(
    (
      first,
      second,
    ) =>
      first.durationSeconds -
      second.durationSeconds,
  )

  const selected =
    alternatives[0]

  if (!selected) {
    throw new Error(
      'Nessuna alternativa valutabile.',
    )
  }

  return {
    criterion:
      'fastest-static',

    alternatives,
    selected,
    rejectedCandidates,
  }
}
