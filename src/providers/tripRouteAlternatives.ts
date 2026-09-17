import type {
  RoutePoint,
} from './routingProvider'

import {
  evaluateFerryRouteAlternatives,
  type EvaluatedRouteAlternative,
} from '../ferries/ferryRouteEvaluator'

import type {
  FerryCandidate,
} from '../ferries/ferryCandidateFinder'

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

function convertRoadSection(
  section:
    EvaluatedRouteAlternative['sections'][number],
): RoadRouteSection | null {
  if (
    section.type !==
    'road'
  ) {
    return null
  }

  return {
    id:
      section.id,

    type:
      'road',

    from:
      section.from,

    to:
      section.to,

    distanceMeters:
      section.distanceMeters,

    durationSeconds:
      section.durationSeconds,

    geometry:
      section.geometry,
  }
}

function convertFerrySection(
  section:
    EvaluatedRouteAlternative['sections'][number],
  candidate:
    FerryCandidate,
): FerryRouteSection | null {
  if (
    section.type !==
    'ferry'
  ) {
    return null
  }

  return {
    id:
      section.id,

    type:
      'ferry',

    from:
      section.from,

    to:
      section.to,

    distanceMeters:
      section.distanceMeters,

    durationSeconds:
      section.durationSeconds,

    geometry:
      section.geometry,

    candidate,
  }
}

function convertAlternative(
  evaluated:
    EvaluatedRouteAlternative,
): RouteAlternative {
  const sections:
    TripRouteSection[] = []

  for (
    const section
    of evaluated.sections
  ) {
    const road =
      convertRoadSection(
        section,
      )

    if (road) {
      sections.push(
        road,
      )

      continue
    }

    const candidate =
      evaluated
        .ferryCandidate

    if (!candidate) {
      throw new Error(
        'Alternativa traghetto senza candidato associato.',
      )
    }

    const ferry =
      convertFerrySection(
        section,
        candidate,
      )

    if (ferry) {
      sections.push(
        ferry,
      )
    }
  }

  const plan =
    summarizeSections(
      sections,
    )

  if (
    evaluated.kind ===
    'direct-osrm'
  ) {
    return {
      id:
        'road-only',

      label:
        'Percorso diretto OSRM',

      kind:
        'road-only',

      plan,
    }
  }

  const candidate =
    evaluated
      .ferryCandidate

  if (!candidate) {
    throw new Error(
      'Alternativa traghetto senza candidato associato.',
    )
  }

  return {
    id:
      `ferry:${candidate.serviceView.service.id}`,

    label:
      evaluated.label,

    kind:
      'ferry',

    plan,

    ferryCandidate:
      candidate,
  }
}

export async function planFastestRouteAlternatives(
  start: RoutePoint,
  destination: RoutePoint,
  allowFerries: boolean,
): Promise<RouteAlternativesResult> {
  const evaluated =
    await evaluateFerryRouteAlternatives(
      start,
      destination,
      {
        includeKnownFerries:
          allowFerries,
      },
    )

  const alternatives =
    evaluated
      .alternatives
      .map(
        convertAlternative,
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
