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

const placeCache =
  new Map<string, GeocodingResult>()

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

function candidateScore(
  query: string,
  candidate: SmartGeocodingResult,
  anchor?: GeocodingResult,
) {
  let score = 0

  const queryNormalized =
    normalizeText(query)

  const nameNormalized =
    normalizeText(candidate.name)

  if (nameNormalized === queryNormalized) {
    score -= 80
  } else if (
    nameNormalized.includes(queryNormalized) ||
    queryNormalized.includes(nameNormalized)
  ) {
    score -= 25
  }

  if (candidate.kind === 'place') {
    score -= 20
  }

  if (anchor) {
    score +=
      Math.min(
        distanceKm(anchor, candidate),
        3000,
      ) / 8
  }

  return score
}

async function resolvePlace(
  name: string,
  anchor?: GeocodingResult,
): Promise<GeocodingResult> {
  const key =
    normalizeText(name)

  const cached =
    placeCache.get(key)

  if (cached) {
    return cached
  }

  const results =
    await autocompletePlaces(name)

  if (results.length === 0) {
    throw new Error(
      `Località non trovata: ${name}`,
    )
  }

  const best =
    [...results].sort(
      (a, b) =>
        candidateScore(name, a, anchor) -
        candidateScore(name, b, anchor),
    )[0]

  if (!best) {
    throw new Error(
      `Località non trovata: ${name}`,
    )
  }

  const resolved: GeocodingResult = {
    id: best.id,
    name: best.name,
    label: best.label,
    lat: best.lat,
    lng: best.lng,
    category: best.category,
    type: best.type,
    osmType: best.osmType,
    osmId: best.osmId,
    boundingBox: best.boundingBox,
  }

  placeCache.set(
    key,
    resolved,
  )

  return resolved
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

  const places: GeocodingResult[] = []
  let previous = anchor

  for (const name of names) {
    const resolved =
      await resolvePlace(
        name,
        previous,
      )

    places.push(resolved)
    previous = resolved
  }

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
  placeCache.clear()
}
