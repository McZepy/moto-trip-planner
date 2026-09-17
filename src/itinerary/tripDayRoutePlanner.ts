import type { GeocodingResult } from '../providers/geocodingProvider'
import type {
  RoutePoint,
  RoutingProvider,
} from '../providers/routingProvider'
import {
  autocompleteLocalities,
  autocompletePlaces,
  type SmartGeocodingResult,
} from '../providers/autocompleteProvider'
import {
  rankAutocompleteSuggestions,
} from '../providers/autocompleteRanking'
import {
  planFastestRouteAlternatives,
  type RouteAlternative,
} from '../providers/tripRouteAlternatives'
import type {
  TripRoutePlan,
} from '../providers/tripRoutePlanner'
import {
  multiLegPlanToTripRoutePlan,
  planMultiLegRoute,
} from '../providers/multiLegTripPlanner'
import {
  resolveZonePassPoint,
} from '../providers/waypointResolver'
import type { TripDay } from '../types/tripDay'
import { getTripDayPlaces } from './itineraryTextParser'
import {
  resolveGeographicSearchHint,
  resolveGeographicSearchQuery,
} from './geographicAliases'

export type TripDayRouteStats = {
  distanceMeters: number
  durationSeconds: number
  usesFerry: boolean
}

export type TripDayRouteResult = {
  day: TripDay
  places: GeocodingResult[]
  plan: TripRoutePlan
  stats: TripDayRouteStats
}

export type TripDaysRouteResult = {
  plan: TripRoutePlan
  dayResults: TripDayRouteResult[]
}

export type TripDayRoutingLeg = {
  from: string
  to: string
  fromPlaceIndex: number
  toPlaceIndex: number
  explicitFerry: boolean
}

type CandidateChoice = {
  candidate: SmartGeocodingResult
  sourceIndex: number
}

type SequenceNode = {
  cost: number
  previousIndex: number | null
}

const candidateCache =
  new Map<string, SmartGeocodingResult[]>()

const EXPLICIT_FERRY_ENDPOINT_TOLERANCE_KM =
  60

function normalizeText(
  value: string,
) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

function distanceKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
) {
  const toRad =
    (value: number) =>
      (value * Math.PI) / 180

  const earthRadiusKm = 6371
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)
  const deltaLat = toRad(b.lat - a.lat)
  const deltaLng = toRad(b.lng - a.lng)

  const sinLat = Math.sin(deltaLat / 2)
  const sinLng = Math.sin(deltaLng / 2)

  const h =
    sinLat * sinLat +
    Math.cos(lat1) *
      Math.cos(lat2) *
      sinLng * sinLng

  return (
    2 *
    earthRadiusKm *
    Math.atan2(
      Math.sqrt(h),
      Math.sqrt(1 - h),
    )
  )
}

function isLocalityType(
  value?: string,
) {
  return [
    'city',
    'town',
    'village',
    'municipality',
    'hamlet',
    'locality',
  ].includes(
    normalizeText(
      value ?? '',
    ),
  )
}

function baseCandidateScore(
  query: string,
  choice: CandidateChoice,
) {
  const candidate =
    choice.candidate

  const queryNormalized =
    normalizeText(query)

  const nameNormalized =
    normalizeText(candidate.name)

  let score =
    choice.sourceIndex * 7

  if (
    nameNormalized ===
    queryNormalized
  ) {
    score -= 120
  } else if (
    nameNormalized.includes(
      queryNormalized,
    ) ||
    queryNormalized.includes(
      nameNormalized,
    )
  ) {
    score -= 35
  }

  if (
    candidate.kind ===
    'place'
  ) {
    score -= 25
  }

  if (
    isLocalityType(
      candidate.type,
    )
  ) {
    score -= 18
  }

  if (
    candidate.kind ===
    'address'
  ) {
    score += 20
  }

  if (
    candidate.kind ===
    'ferry-terminal'
  ) {
    score += 12
  }

  return score
}

function transitionScore(
  from: {
    lat: number
    lng: number
  },
  to: {
    lat: number
    lng: number
  },
) {
  return (
    distanceKm(
      from,
      to,
    ) * 0.45
  )
}

async function loadCandidates(
  name: string,
  focus?: {
    lat: number
    lng: number
  },
): Promise<SmartGeocodingResult[]> {
  const hint =
    resolveGeographicSearchHint(
      name,
    )

  const focusKey =
    focus
      ? focus.lat.toFixed(2) + ',' + focus.lng.toFixed(2)
      : 'global'

  const key =
    normalizeText(hint.query) +
    '|' +
    hint.kind +
    '|' +
    focusKey

  const cached =
    candidateCache.get(key)

  if (cached) {
    return cached
  }

  const results =
    hint.kind === 'locality'
      ? await autocompleteLocalities(
          hint.query,
          undefined,
          {
            focus,
            boundedToFocus:
              Boolean(focus),
          },
        )
      : await autocompletePlaces(
          hint.query,
          undefined,
          {
            focus,
            boundedToFocus:
              Boolean(focus),
          },
        )

  if (
    results.length === 0
  ) {
    throw new Error(
      'Località non trovata: ' +
      name +
      (
        hint.query !== name
          ? ' (' + hint.query + ')'
          : ''
      ),
    )
  }

  candidateCache.set(
    key,
    results,
  )

  return results
}

function toGeocodingResult(
  candidate: SmartGeocodingResult,
): GeocodingResult {
  return {
    id: candidate.id,
    name: candidate.name,
    label: candidate.label,
    lat: candidate.lat,
    lng: candidate.lng,
    category: candidate.category,
    type: candidate.type,
    osmType: candidate.osmType,
    osmId: candidate.osmId,
    boundingBox: candidate.boundingBox,
  }
}

export function selectBestGeocodingSequence(
  names: string[],
  candidateGroups: SmartGeocodingResult[][],
  anchor?: GeocodingResult,
): GeocodingResult[] {
  if (
    names.length === 0 ||
    candidateGroups.length !==
      names.length
  ) {
    throw new Error(
      'Sequenza località non valida.',
    )
  }

  const groups:
    CandidateChoice[][] =
      candidateGroups.map(
        (group) =>
          group
            .slice(0, 10)
            .map(
              (candidate, sourceIndex) => ({
                candidate,
                sourceIndex,
              }),
            ),
      )

  if (
    groups.some(
      (group) =>
        group.length === 0,
    )
  ) {
    throw new Error(
      'Una o più località non hanno candidati utilizzabili.',
    )
  }

  const matrix:
    SequenceNode[][] = []

  matrix[0] =
    groups[0].map(
      (choice) => ({
        cost:
          baseCandidateScore(
            names[0],
            choice,
          ) +
          (
            anchor
              ? transitionScore(
                  anchor,
                  choice.candidate,
                )
              : 0
          ),
        previousIndex:
          null,
      }),
    )

  for (
    let groupIndex = 1;
    groupIndex < groups.length;
    groupIndex += 1
  ) {
    const previousGroup =
      groups[groupIndex - 1]

    const previousNodes =
      matrix[groupIndex - 1]

    matrix[groupIndex] =
      groups[groupIndex].map(
        (choice) => {
          let bestCost =
            Number.POSITIVE_INFINITY

          let bestPreviousIndex =
            0

          previousGroup.forEach(
            (
              previousChoice,
              previousIndex,
            ) => {
              const previousNode =
                previousNodes[previousIndex]

              const cost =
                previousNode.cost +
                transitionScore(
                  previousChoice.candidate,
                  choice.candidate,
                ) +
                baseCandidateScore(
                  names[groupIndex],
                  choice,
                )

              if (
                cost < bestCost
              ) {
                bestCost =
                  cost

                bestPreviousIndex =
                  previousIndex
              }
            },
          )

          return {
            cost:
              bestCost,
            previousIndex:
              bestPreviousIndex,
          }
        },
      )
  }

  const lastNodes =
    matrix.at(-1) ?? []

  let selectedIndex =
    lastNodes.reduce(
      (
        bestIndex,
        node,
        index,
      ) =>
        node.cost <
        lastNodes[bestIndex].cost
          ? index
          : bestIndex,
      0,
    )

  const selected:
    SmartGeocodingResult[] =
      new Array(groups.length)

  for (
    let groupIndex =
      groups.length - 1;
    groupIndex >= 0;
    groupIndex -= 1
  ) {
    selected[groupIndex] =
      groups[groupIndex][
        selectedIndex
      ].candidate

    const previousIndex =
      matrix[groupIndex][
        selectedIndex
      ].previousIndex

    if (
      previousIndex === null
    ) {
      break
    }

    selectedIndex =
      previousIndex
  }

  return selected.map(
    toGeocodingResult,
  )
}

export function getTripDayRoutingLegs(
  day: TripDay,
): TripDayRoutingLeg[] {
  const legs:
    TripDayRoutingLeg[] = []

  let previousName:
    string | null = null

  let previousPlaceIndex =
    -1

  let currentPlaceIndex =
    -1

  let explicitFerry =
    false

  for (const step of day.steps) {
    if (step.kind === 'ferry') {
      explicitFerry =
        true
      continue
    }

    currentPlaceIndex += 1

    if (previousName !== null) {
      legs.push({
        from:
          previousName,
        to:
          step.name,
        fromPlaceIndex:
          previousPlaceIndex,
        toPlaceIndex:
          currentPlaceIndex,
        explicitFerry,
      })
    }

    previousName =
      step.name

    previousPlaceIndex =
      currentPlaceIndex

    explicitFerry =
      false
  }

  return legs
}

function explicitFerryAlternative(
  alternatives:
    RouteAlternative[],
  from:
    GeocodingResult,
  to:
    GeocodingResult,
) {
  return alternatives
    .filter(
      (alternative) => {
        if (
          alternative.kind !==
          'ferry' ||
          !alternative.ferryCandidate
        ) {
          return false
        }

        const candidate =
          alternative.ferryCandidate

        return (
          distanceKm(
            from,
            candidate.departurePoint,
          ) <=
            EXPLICIT_FERRY_ENDPOINT_TOLERANCE_KM &&
          distanceKm(
            to,
            candidate.arrivalPoint,
          ) <=
            EXPLICIT_FERRY_ENDPOINT_TOLERANCE_KM
        )
      },
    )
    .sort(
      (first, second) =>
        first.plan.durationSeconds -
        second.plan.durationSeconds,
    )[0]
}

async function planDayLeg(
  day: TripDay,
  legIndex: number,
  leg: TripDayRoutingLeg,
  from: GeocodingResult,
  to: GeocodingResult,
  routingProvider?:
    RoutingProvider,
): Promise<TripRoutePlan> {
  const result =
    await planFastestRouteAlternatives(
      {
        lat: from.lat,
        lng: from.lng,
      },
      {
        lat: to.lat,
        lng: to.lng,
      },
      leg.explicitFerry,
      routingProvider,
    )

  let selected =
    result.selected

  if (leg.explicitFerry) {
    const ferry =
      explicitFerryAlternative(
        result.alternatives,
        from,
        to,
      )

    if (!ferry) {
      throw new Error(
        `Giorno ${day.dayNumber}: il traghetto esplicito ${leg.from} → ${leg.to} non è disponibile nel catalogo con dati sufficienti per il calcolo.`,
      )
    }

    selected =
      ferry
  }

  return {
    ...selected.plan,
    sections:
      selected.plan.sections.map(
        (section, sectionIndex) => ({
          ...section,
          id:
            `day:${day.dayNumber}:leg:${legIndex}:section:${sectionIndex}:${section.id}`,
        }),
      ),
  }
}

async function resolveSinglePlace(
  name: string,
  focus?: GeocodingResult,
) {
  const candidates =
    await loadCandidates(
      name,
      focus,
    )

  const searchQuery =
    resolveGeographicSearchQuery(
      name,
    )

  const ranked =
    rankAutocompleteSuggestions(
      searchQuery,
      candidates,
      focus,
    )

  const selected =
    ranked[0]

  if (!selected) {
    throw new Error(
      'Località non trovata: ' +
      name,
    )
  }

  return toGeocodingResult(
    selected,
  )
}

export async function resolveTripDayEditorDraft(
  day: TripDay,
  anchor?: GeocodingResult,
) {
  if (day.routingOverride) {
    return {
      startPlace: {
        ...day.routingOverride
          .startPlace,
      },

      destinationPlace: {
        ...day.routingOverride
          .destinationPlace,
      },

      waypoints:
        day.routingOverride
          .waypoints
          .map(
            (waypoint) => ({
              ...waypoint,

              boundingBox:
                waypoint.boundingBox
                  ? {
                      ...waypoint.boundingBox,
                    }
                  : undefined,
            }),
          ),
    }
  }

  const names =
    getTripDayPlaces(
      day,
    )

  if (names.length < 2) {
    throw new Error(
      `Giorno ${day.dayNumber}: servono almeno partenza e arrivo.`,
    )
  }

  const startPlace =
    await resolveSinglePlace(
      names[0],
      anchor,
    )

  const destinationPlace =
    await resolveSinglePlace(
      names.at(-1) as string,
      startPlace,
    )

  return {
    startPlace,
    destinationPlace,
    waypoints: [],
  }
}

async function overrideRoutePoints(
  day: TripDay,
): Promise<RoutePoint[]> {
  const override =
    day.routingOverride

  if (!override) {
    return []
  }

  const points:
    RoutePoint[] = [
      {
        lat:
          override
            .startPlace
            .lat,

        lng:
          override
            .startPlace
            .lng,
      },
  ]

  let previous =
    points[0]

  for (
    let index = 0;
    index <
      override.waypoints.length;
    index += 1
  ) {
    const waypoint =
      override.waypoints[index]

    let nextReference:
      RoutePoint = {
        lat:
          override
            .destinationPlace
            .lat,

        lng:
          override
            .destinationPlace
            .lng,
      }

    for (
      let nextIndex =
        index + 1;
      nextIndex <
        override
          .waypoints
          .length;
      nextIndex += 1
    ) {
      const candidate =
        override
          .waypoints[
            nextIndex
          ]

      if (
        candidate.type !==
        'zone-pass'
      ) {
        nextReference = {
          lat:
            candidate.lat,

          lng:
            candidate.lng,
        }

        break
      }
    }

    if (
      waypoint.type ===
      'zone-pass'
    ) {
      const resolved =
        await resolveZonePassPoint(
          waypoint,
          previous,
          nextReference,
        )

      if (resolved) {
        points.push(
          resolved,
        )

        previous =
          resolved
      }

      continue
    }

    const resolved = {
      lat:
        waypoint.lat,

      lng:
        waypoint.lng,
    }

    points.push(
      resolved,
    )

    previous =
      resolved
  }

  points.push({
    lat:
      override
        .destinationPlace
        .lat,

    lng:
      override
        .destinationPlace
        .lng,
  })

  return points
}

export async function planTripDayRoute(
  day: TripDay,
  allowAutomaticFerries: boolean,
  anchor?: GeocodingResult,
  routingProvider?:
    RoutingProvider,
): Promise<TripDayRouteResult> {
  const draft =
    await resolveTripDayEditorDraft(
      day,
      anchor,
    )

  let plan:
    TripRoutePlan

  if (day.routingOverride) {
    const points =
      await overrideRoutePoints(
        day,
      )

    const multiLeg =
      await planMultiLegRoute(
        points,
        allowAutomaticFerries,
        routingProvider,
      )

    plan =
      multiLegPlanToTripRoutePlan(
        multiLeg,
      )
  } else {
    const syntheticLeg:
      TripDayRoutingLeg = {
      from:
        draft.startPlace.name,
      to:
        draft.destinationPlace.name,
      fromPlaceIndex:
        0,
      toPlaceIndex:
        1,
      explicitFerry:
        false,
    }

    plan =
      await planDayLeg(
        day,
        0,
        syntheticLeg,
        draft.startPlace,
        draft.destinationPlace,
        routingProvider,
      )
  }

  return {
    day,

    places: [
      draft.startPlace,
      draft.destinationPlace,
    ],

    plan,

    stats: {
      distanceMeters:
        plan.distanceMeters,

      durationSeconds:
        plan.durationSeconds,

      usesFerry:
        plan.usesFerry,
    },
  }
}

export async function planTripDaysRoute(
  days: TripDay[],
  allowAutomaticFerries: boolean,
  onProgress?: (
    completed: number,
    total: number,
    day: TripDay,
  ) => void,
  routingProvider?:
    RoutingProvider,
): Promise<TripDaysRouteResult> {
  if (days.length === 0) {
    throw new Error(
      'Nessuna giornata da calcolare.',
    )
  }

  const dayResults:
    TripDayRouteResult[] = []

  let anchor:
    GeocodingResult | undefined

  for (
    let index = 0;
    index < days.length;
    index += 1
  ) {
    const day =
      days[index]

    const result =
      await planTripDayRoute(
        day,
        allowAutomaticFerries,
        anchor,
        routingProvider,
      )

    dayResults.push(
      result,
    )

    anchor =
      result.places.at(-1)

    onProgress?.(
      index + 1,
      days.length,
      day,
    )
  }

  const sections =
    dayResults.flatMap(
      (result) =>
        result.plan.sections,
    )

  const plan: TripRoutePlan = {
    sections,
    distanceMeters:
      dayResults.reduce(
        (total, result) =>
          total +
          result.plan.distanceMeters,
        0,
      ),
    durationSeconds:
      dayResults.reduce(
        (total, result) =>
          total +
          result.plan.durationSeconds,
        0,
      ),
    usesFerry:
      dayResults.some(
        (result) =>
          result.plan.usesFerry,
      ),
  }

  return {
    plan,
    dayResults,
  }
}

export function clearTripDayPlaceCache() {
  candidateCache.clear()
}
