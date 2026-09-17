import type {
  RouteStyle,
  TripRoadPreferences,
} from '../types/trip'

import type {
  RoutePoint,
  RouteResult,
  RoutingProvider,
} from './routingProvider'

const TOMTOM_ROUTING_BASE_URL =
  'https://api.tomtom.com/routing/1/calculateRoute'

export type TomTomRouteProfile = {
  routeType:
    | 'fastest'
    | 'thrilling'

  windingness?:
    | 'low'
    | 'normal'
    | 'high'

  hilliness?:
    | 'low'
    | 'normal'
    | 'high'
}

export type TomTomRoutingOptions = {
  routeStyle:
    RouteStyle

  roadPreferences:
    TripRoadPreferences

  traffic?:
    boolean
}

type TomTomPoint = {
  latitude: number
  longitude: number
}

type TomTomRouteResponse = {
  routes?: Array<{
    summary?: {
      lengthInMeters?: number
      travelTimeInSeconds?: number
    }

    legs?: Array<{
      points?: TomTomPoint[]
    }>
  }>

  detailedError?: {
    message?: string
  }

  error?: string
}

function getTomTomApiKey() {
  const key =
    import.meta.env
      .VITE_TOMTOM_KEY

  if (
    !key ||
    typeof key !==
      'string'
  ) {
    throw new Error(
      'Chiave TomTom non configurata nel file .env.',
    )
  }

  return key
}

export function hasTomTomApiKey() {
  const key =
    import.meta.env
      .VITE_TOMTOM_KEY

  return (
    typeof key === 'string' &&
    key.trim().length > 0
  )
}

export function getTomTomRouteProfile(
  routeStyle:
    RouteStyle,
): TomTomRouteProfile {
  if (
    routeStyle === 'curvy'
  ) {
    return {
      routeType:
        'thrilling',
      windingness:
        'high',
      hilliness:
        'normal',
    }
  }

  if (
    routeStyle === 'scenic'
  ) {
    return {
      routeType:
        'thrilling',
      windingness:
        'normal',
      hilliness:
        'high',
    }
  }

  if (
    routeStyle === 'mixed'
  ) {
    return {
      routeType:
        'thrilling',
      windingness:
        'low',
      hilliness:
        'low',
    }
  }

  return {
    routeType:
      'fastest',
  }
}

export function getTomTomAvoids(
  preferences:
    TripRoadPreferences,
) {
  const avoids:
    string[] = [
      // I traghetti restano responsabilità del FerryCatalog MotoRoute.
      // In questo modo il motore stradale non inserisce traghetti nascosti.
      'ferries',
    ]

  if (
    preferences.avoidUnpaved
  ) {
    avoids.push(
      'unpavedRoads',
    )
  }

  if (
    preferences.avoidMotorways
  ) {
    avoids.push(
      'motorways',
    )
  }

  if (
    preferences.avoidTolls
  ) {
    avoids.push(
      'tollRoads',
    )
  }

  return avoids
}

export function buildTomTomRoutingParameters(
  options:
    TomTomRoutingOptions,
) {
  const profile =
    getTomTomRouteProfile(
      options.routeStyle,
    )

  return {
    profile,
    avoids:
      getTomTomAvoids(
        options.roadPreferences,
      ),
    traffic:
      options.traffic ??
      false,
  }
}

function routeLocations(
  points:
    RoutePoint[],
) {
  return points
    .map(
      (point) =>
        `${point.lat},${point.lng}`,
    )
    .join(':')
}

function appendAvoids(
  params:
    URLSearchParams,
  avoids:
    string[],
) {
  avoids.forEach(
    (avoid) =>
      params.append(
        'avoid',
        avoid,
      ),
  )
}

function responseGeometry(
  route:
    NonNullable<
      TomTomRouteResponse['routes']
    >[number],
) {
  const coordinates:
    number[][] = []

  for (
    const leg
    of route.legs ?? []
  ) {
    for (
      const point
      of leg.points ?? []
    ) {
      const coordinate =
        [
          point.longitude,
          point.latitude,
        ]

      const previous =
        coordinates.at(-1)

      if (
        previous &&
        previous[0] ===
          coordinate[0] &&
        previous[1] ===
          coordinate[1]
      ) {
        continue
      }

      coordinates.push(
        coordinate,
      )
    }
  }

  return coordinates
}

function tomTomErrorMessage(
  data:
    TomTomRouteResponse | null,
  status:
    number,
) {
  const detail =
    data?.detailedError
      ?.message ??
    data?.error

  if (detail) {
    return (
      `TomTom Routing non disponibile (${status}): ${detail}`
    )
  }

  if (
    status === 403
  ) {
    return 'TomTom Routing: chiave API non autorizzata.'
  }

  if (
    status === 429
  ) {
    return 'TomTom Routing: limite gratuito richieste raggiunto.'
  }

  return (
    `TomTom Routing non disponibile (${status}).`
  )
}

export function createTomTomRoutingProvider(
  options:
    TomTomRoutingOptions,
): RoutingProvider {
  return {
    async calculateRoute(
      points,
    ): Promise<RouteResult> {
      if (
        points.length < 2
      ) {
        throw new Error(
          'Servono almeno partenza e destinazione.',
        )
      }

      const key =
        getTomTomApiKey()

      const settings =
        buildTomTomRoutingParameters(
          options,
        )

      const params =
        new URLSearchParams({
          key,
          travelMode:
            'motorcycle',
          routeType:
            settings
              .profile
              .routeType,
          traffic:
            settings.traffic
              ? 'true'
              : 'false',
          routeRepresentation:
            'polyline',
          coordinatePrecision:
            'full',
          language:
            'it-IT',
        })

      if (
        settings.profile
          .routeType ===
        'thrilling'
      ) {
        params.set(
          'windingness',
          settings.profile
            .windingness ??
            'normal',
        )

        params.set(
          'hilliness',
          settings.profile
            .hilliness ??
            'normal',
        )
      }

      appendAvoids(
        params,
        settings.avoids,
      )

      const url =
        `${TOMTOM_ROUTING_BASE_URL}/` +
        `${routeLocations(points)}/json?` +
        params.toString()

      const response =
        await fetch(url, {
          headers: {
            Accept:
              'application/json',
          },
        })

      let data:
        TomTomRouteResponse | null =
          null

      try {
        data =
          (await response.json()) as
            TomTomRouteResponse
      } catch {
        // La risposta può essere vuota in caso di errore infrastrutturale.
      }

      if (!response.ok) {
        throw new Error(
          tomTomErrorMessage(
            data,
            response.status,
          ),
        )
      }

      const route =
        data?.routes?.[0]

      const distanceMeters =
        route?.summary
          ?.lengthInMeters

      const durationSeconds =
        route?.summary
          ?.travelTimeInSeconds

      const coordinates =
        route
          ? responseGeometry(
              route,
            )
          : []

      if (
        !route ||
        !Number.isFinite(
          distanceMeters,
        ) ||
        !Number.isFinite(
          durationSeconds,
        ) ||
        coordinates.length < 2
      ) {
        throw new Error(
          'TomTom non ha restituito un percorso utilizzabile.',
        )
      }

      return {
        distanceMeters:
          distanceMeters as number,
        durationSeconds:
          durationSeconds as number,
        geometry: {
          type:
            'LineString',
          coordinates,
        },
      }
    },
  }
}
