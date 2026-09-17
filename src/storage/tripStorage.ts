import type { GeocodingResult } from '../providers/geocodingProvider'
import type { TripSettings } from '../types/trip'
import { defaultTripSettings } from '../types/trip'
import type { TripDay } from '../types/tripDay'
import type { Waypoint } from '../types/waypoint'

export type TripRecord = {
  id: string
  name: string

  startPlace: GeocodingResult | null
  destinationPlace: GeocodingResult | null

  waypoints: Waypoint[]
  days: TripDay[]

  settings: TripSettings

  distance: number | null
  duration: number | null

  updatedAt: string
}

const STORAGE_KEY =
  'moto-route-trips-v1'

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

function cloneDefaultSettings(): TripSettings {
  return {
    ...defaultTripSettings,

    roadPreferences: {
      ...defaultTripSettings.roadPreferences,
    },
  }
}

function normalizeSettings(
  settings?: Partial<TripSettings>,
): TripSettings {
  const defaults =
    cloneDefaultSettings()

  return {
    ...defaults,
    ...settings,

    roadPreferences: {
      ...defaults.roadPreferences,
      ...(settings?.roadPreferences ?? {}),
    },
  }
}

function cloneDays(
  days: TripDay[] | undefined,
): TripDay[] {
  return (days ?? []).map(
    (day) => ({
      ...day,
      steps:
        day.steps.map(
          (step) => ({
            ...step,
          }),
        ),
      notes:
        [...day.notes],
    }),
  )
}

export function getSavedTrips(): TripRecord[] {
  try {
    const raw =
      localStorage.getItem(
        STORAGE_KEY,
      )

    if (!raw) {
      return []
    }

    const stored =
      JSON.parse(raw) as Array<
        Omit<
          TripRecord,
          'settings' | 'days'
        > & {
          settings?: Partial<TripSettings>
          days?: TripDay[]
        }
      >

    const trips: TripRecord[] =
      stored.map((trip) => ({
        ...trip,

        waypoints:
          trip.waypoints ?? [],

        days:
          cloneDays(
            trip.days,
          ),

        settings:
          normalizeSettings(
            trip.settings,
          ),
      }))

    return trips.sort(
      (a, b) =>
        new Date(
          b.updatedAt,
        ).getTime() -
        new Date(
          a.updatedAt,
        ).getTime(),
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
    'id' | 'updatedAt' | 'settings' | 'days'
  > & {
    settings?: TripSettings
    days?: TripDay[]
  },
  existingId?: string | null,
): TripRecord {
  const trips =
    getSavedTrips()

  const existingTrip =
    existingId
      ? trips.find(
          (item) =>
            item.id === existingId,
        )
      : undefined

  const savedTrip: TripRecord = {
    ...trip,

    days:
      cloneDays(
        trip.days ??
          existingTrip?.days,
      ),

    settings:
      normalizeSettings(
        trip.settings ??
          existingTrip?.settings,
      ),

    id:
      existingId ??
      createId(),

    updatedAt:
      new Date().toISOString(),
  }

  const index =
    trips.findIndex(
      (item) =>
        item.id === savedTrip.id,
    )

  if (index >= 0) {
    trips[index] =
      savedTrip
  } else {
    trips.unshift(
      savedTrip,
    )
  }

  writeTrips(trips)

  return savedTrip
}

export function deleteTrip(
  id: string,
) {
  const trips =
    getSavedTrips().filter(
      (trip) =>
        trip.id !== id,
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
  const trips =
    getSavedTrips()

  const source =
    trips.find(
      (trip) =>
        trip.id === id,
    )

  if (!source) {
    return null
  }

  const copy: TripRecord = {
    ...source,

    waypoints:
      source.waypoints.map(
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

    days:
      cloneDays(
        source.days,
      ),

    settings: {
      ...source.settings,

      roadPreferences: {
        ...source.settings
          .roadPreferences,
      },
    },

    id:
      createId(),

    name:
      createCopyName(
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
