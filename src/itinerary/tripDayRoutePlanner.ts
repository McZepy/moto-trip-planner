import type { GeocodingResult } from '../providers/geocodingProvider'
import {
  autocompletePlaces,
  type SmartGeocodingResult,
} from '../providers/autocompleteProvider'
import {
  multiLegPlanToTripRoutePlan,
  planMultiLegRoute,
} from '../providers/multiLegTripPlanner'
import type { TripRoutePlan } from '../providers/tripRoutePlanner'
import type { TripDay } from '../types/tripDay'
import { getTripDayPlaces } from './itineraryTextParser'

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
): Promise<SmartGeocodingResult[]> {
  const key =
    normalizeText(name)

  const cached =
    candidateCache.get(key)

  if (cached) {
    return cached
  }

  const results =
    await autocompletePlaces(name)

  if (
    results.length === 0
  ) {
    throw new Error(
      `Località non trovata: ${name}`,
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

async function resolvePlaces(
  names: string[],
  anchor?: GeocodingResult,
) {
  const candidateGroups:
    SmartGeocodingResult[][] = []

  for (const name of names) {
    candidateGroups.push(
      await loadCandidates(name),
    )
  }

  return selectBestGeocodingSequence(
    names,
    candidateGroups,
    anchor,
  )
}

function dayHasExplicitFerry(
  day: TripDay,
) {
  return day.steps.some(
    (step) =>
      step.kind === 'ferry',
  )
}

export async function planTripDayRoute(
  day: TripDay,
  allowFerries: boolean,
  anchor?: GeocodingResult,
): Promise<TripDayRouteResult> {
  const names =
    getTripDayPlaces(day)

  if (names.length < 2) {
    throw new Error(
      `Giorno ${day.dayNumber}: servono almeno partenza e arrivo.`,
    )
  }

  const places =
    await resolvePlaces(
      names,
      anchor,
    )

  const multiLeg =
    await planMultiLegRoute(
      places.map(
        (place) => ({
          lat: place.lat,
          lng: place.lng,
        }),
      ),
      allowFerries ||
        dayHasExplicitFerry(day),
    )

  const plan =
    multiLegPlanToTripRoutePlan(
      multiLeg,
    )

  return {
    day,
    places,
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
  allowFerries: boolean,
  onProgress?: (
    completed: number,
    total: number,
    day: TripDay,
  ) => void,
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
    const day = days[index]

    const result =
      await planTripDayRoute(
        day,
        allowFerries,
        anchor,
      )

    dayResults.push(result)

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
