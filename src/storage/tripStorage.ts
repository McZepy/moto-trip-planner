import type { GeocodingResult } from '../providers/geocodingProvider'

export type TripRecord = {
  id: string
  name: string

  startPlace: GeocodingResult | null
  destinationPlace: GeocodingResult | null

  distance: number | null
  duration: number | null

  updatedAt: string
}

const STORAGE_KEY = 'moto-route-trips-v1'

function createId() {
  if (
    typeof crypto !== 'undefined' &&
    crypto.randomUUID
  ) {
    return crypto.randomUUID()
  }

  return `${Date.now()}-${Math.random()
    .toString(16)
    .slice(2)}`
}

export function getSavedTrips(): TripRecord[] {
  try {
    const raw =
      localStorage.getItem(STORAGE_KEY)

    if (!raw) {
      return []
    }

    const trips =
      JSON.parse(raw) as TripRecord[]

    return trips.sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() -
        new Date(a.updatedAt).getTime(),
    )
  } catch {
    return []
  }
}

function writeTrips(
  trips: TripRecord[],
) {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(trips),
  )
}

export function saveTrip(
  trip: Omit<
    TripRecord,
    'id' | 'updatedAt'
  >,
  existingId?: string | null,
): TripRecord {
  const trips = getSavedTrips()

  const savedTrip: TripRecord = {
    ...trip,

    id:
      existingId ??
      createId(),

    updatedAt:
      new Date().toISOString(),
  }

  const index = trips.findIndex(
    (item) =>
      item.id === savedTrip.id,
  )

  if (index >= 0) {
    trips[index] = savedTrip
  } else {
    trips.unshift(savedTrip)
  }

  writeTrips(trips)

  return savedTrip
}

export function deleteTrip(
  id: string,
) {
  const trips =
    getSavedTrips().filter(
      (trip) => trip.id !== id,
    )

  writeTrips(trips)
}

function createCopyName(
  sourceName: string,
  trips: TripRecord[],
) {
  const firstCopy =
    `${sourceName} - copia`

  const existingNames =
    new Set(
      trips.map((trip) =>
        trip.name.toLowerCase(),
      ),
    )

  if (
    !existingNames.has(
      firstCopy.toLowerCase(),
    )
  ) {
    return firstCopy
  }

  let copyNumber = 2

  while (
    existingNames.has(
      `${sourceName} - copia ${copyNumber}`.toLowerCase(),
    )
  ) {
    copyNumber += 1
  }

  return `${sourceName} - copia ${copyNumber}`
}

export function duplicateTrip(
  id: string,
): TripRecord | null {
  const trips = getSavedTrips()

  const source = trips.find(
    (trip) => trip.id === id,
  )

  if (!source) {
    return null
  }

  const copy: TripRecord = {
    ...source,

    id: createId(),

    name: createCopyName(
      source.name,
      trips,
    ),

    updatedAt:
      new Date().toISOString(),
  }

  trips.unshift(copy)

  writeTrips(trips)

  return copy
}