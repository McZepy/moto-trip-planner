import type {
  RoutePoint,
  RoutingProvider,
} from './routingProvider'

import {
  planFastestRouteAlternatives,
  type RouteAlternative,
} from './tripRouteAlternatives'

import type {
  TripRoutePlan,
  TripRouteSection,
} from './tripRoutePlanner'

export type MultiLegRouteLeg = {
  index: number

  from: RoutePoint
  to: RoutePoint

  selectedAlternative:
    RouteAlternative
}

export type MultiLegRoutePlan = {
  legs:
    MultiLegRouteLeg[]

  sections:
    TripRouteSection[]

  distanceMeters:
    number

  durationSeconds:
    number

  usesFerry:
    boolean
}

function summarizeSections(
  sections:
    TripRouteSection[],
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

    usesFerry:
      sections.some(
        (section) =>
          section.type ===
          'ferry',
      ),
  }
}

function cloneSectionForLeg(
  section:
    TripRouteSection,
  legIndex:
    number,
  sectionIndex:
    number,
): TripRouteSection {
  return {
    ...section,

    id:
      `leg:${legIndex}:section:${sectionIndex}:${section.id}`,
  }
}

export async function planMultiLegRoute(
  points:
    RoutePoint[],
  allowFerries:
    boolean,
  routingProvider?:
    RoutingProvider,
): Promise<MultiLegRoutePlan> {
  if (
    points.length < 2
  ) {
    throw new Error(
      'Servono almeno due punti per calcolare il percorso.',
    )
  }

  const legs:
    MultiLegRouteLeg[] = []

  const sections:
    TripRouteSection[] = []

  for (
    let index = 0;
    index <
    points.length - 1;
    index += 1
  ) {
    const from =
      points[index]

    const to =
      points[
        index + 1
      ]

    const result =
      await planFastestRouteAlternatives(
        from,
        to,
        allowFerries,
        routingProvider,
      )

    const selected =
      result.selected

    legs.push({
      index,
      from,
      to,

      selectedAlternative:
        selected,
    })

    selected
      .plan
      .sections
      .forEach(
        (
          section,
          sectionIndex,
        ) => {
          sections.push(
            cloneSectionForLeg(
              section,
              index,
              sectionIndex,
            ),
          )
        },
      )
  }

  const summary =
    summarizeSections(
      sections,
    )

  return {
    legs,
    sections,

    distanceMeters:
      summary.distanceMeters,

    durationSeconds:
      summary.durationSeconds,

    usesFerry:
      summary.usesFerry,
  }
}

export function multiLegPlanToTripRoutePlan(
  plan:
    MultiLegRoutePlan,
): TripRoutePlan {
  return {
    sections:
      plan.sections,

    distanceMeters:
      plan.distanceMeters,

    durationSeconds:
      plan.durationSeconds,

    usesFerry:
      plan.usesFerry,
  }
}
