import type {
  FerryCatalogData,
  FerryDataSource,
  FerryGeoPoint,
  FerryPort,
  FerryRoute,
  FerryService,
  FerryTerminal,
} from './ferryCatalogTypes'

import type {
  OsmFerryImportResult,
  OsmImportedFerryRoute,
  OsmImportedFerryTerminal,
} from './osmFerryImporter'

export type OsmFerryNormalizationStats = {
  sourceRoutes: number
  sourceTerminals: number

  ports: number
  terminals: number
  routes: number
  services: number

  matchedTerminals: number
  syntheticTerminals: number
}

export type OsmFerryNormalizationResult = {
  catalog: FerryCatalogData
  stats: OsmFerryNormalizationStats
}

const TERMINAL_MATCH_KM = 10

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
  first: FerryGeoPoint,
  second: FerryGeoPoint,
) {
  const radius = 6371

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
    toRadians(first.lat)

  const secondLat =
    toRadians(second.lat)

  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(firstLat) *
      Math.cos(secondLat) *
      Math.sin(deltaLng / 2) ** 2

  return (
    radius *
    2 *
    Math.atan2(
      Math.sqrt(a),
      Math.sqrt(1 - a),
    )
  )
}

function slugify(
  value: string,
) {
  return value
    .normalize('NFD')
    .replace(
      /[\u0300-\u036f]/g,
      '',
    )
    .toLowerCase()
    .replace(
      /[^a-z0-9]+/g,
      '-',
    )
    .replace(
      /^-+|-+$/g,
      '',
    )
    .slice(0, 80)
}

function cleanEndpointName(
  value: string | undefined,
) {
  const clean =
    value
      ?.replace(
        /\s+/g,
        ' ',
      )
      .trim()

  return clean || undefined
}

function splitRouteName(
  value: string | undefined,
) {
  const clean =
    cleanEndpointName(value)

  if (!clean) {
    return null
  }

  const separators = [
    /\s+↔\s+/u,
    /\s+→\s+/u,
    /\s+[–—]\s+/u,
    /\s+-\s+/u,
    /\s+to\s+/iu,
  ]

  for (const separator of separators) {
    const parts =
      clean
        .split(separator)
        .map((part) =>
          part.trim(),
        )
        .filter(Boolean)

    if (parts.length === 2) {
      return {
        first: parts[0] as string,
        second: parts[1] as string,
      }
    }
  }

  return null
}

function nearestTerminal(
  point: FerryGeoPoint,
  terminals:
    OsmImportedFerryTerminal[],
) {
  let nearest:
    | {
        terminal:
          OsmImportedFerryTerminal
        distanceKm: number
      }
    | null = null

  for (const terminal of terminals) {
    const currentDistance =
      distanceKm(
        point,
        terminal.point,
      )

    if (
      currentDistance >
      TERMINAL_MATCH_KM
    ) {
      continue
    }

    if (
      !nearest ||
      currentDistance <
        nearest.distanceKm
    ) {
      nearest = {
        terminal,
        distanceKm:
          currentDistance,
      }
    }
  }

  return nearest
}

function sourceForRoute(
  route:
    OsmImportedFerryRoute,
  fetchedAt: string,
): FerryDataSource {
  return {
    kind: 'osm',
    provider:
      'OpenStreetMap',
    reference:
      `${route.osmType}/${route.osmId}`,
    checkedAt:
      fetchedAt,
  }
}

function sourceForTerminal(
  terminal:
    OsmImportedFerryTerminal,
  fetchedAt: string,
): FerryDataSource {
  return {
    kind: 'osm',
    provider:
      'OpenStreetMap',
    reference:
      `${terminal.osmType}/${terminal.osmId}`,
    checkedAt:
      fetchedAt,
  }
}

function terminalStableKey(
  terminal:
    OsmImportedFerryTerminal,
) {
  return (
    `osm-terminal:` +
    `${terminal.osmType}:` +
    `${terminal.osmId}`
  )
}

function endpointName(
  explicitName:
    string | undefined,
  splitName:
    string | undefined,
  matchedTerminal:
    OsmImportedFerryTerminal | undefined,
  fallback: string,
) {
  return (
    cleanEndpointName(
      explicitName,
    ) ??
    cleanEndpointName(
      splitName,
    ) ??
    cleanEndpointName(
      matchedTerminal?.name,
    ) ??
    fallback
  )
}

function portStableKey(
  name: string,
  matchedTerminal:
    OsmImportedFerryTerminal | undefined,
  route:
    OsmImportedFerryRoute,
  side:
    'a' | 'b',
) {
  if (matchedTerminal) {
    return (
      'terminal:' +
      terminalStableKey(
        matchedTerminal,
      )
    )
  }

  const slug =
    slugify(name)

  if (
    slug &&
    !slug.startsWith(
      'porto-osm-',
    )
  ) {
    return `name:${slug}`
  }

  return (
    `route:${route.osmType}:` +
    `${route.osmId}:${side}`
  )
}

function oneWayRoute(
  route:
    OsmImportedFerryRoute,
) {
  const value =
    route.tags.oneway
      ?.trim()
      .toLowerCase()

  return (
    value === 'yes' ||
    value === '1' ||
    value === 'true'
  )
}

export function normalizeOsmFerryImport(
  input:
    OsmFerryImportResult,
): OsmFerryNormalizationResult {
  const portsByKey =
    new Map<
      string,
      FerryPort
    >()

  const terminalsByKey =
    new Map<
      string,
      FerryTerminal
    >()

  const routes:
    FerryRoute[] = []

  const services:
    FerryService[] = []

  let matchedTerminals = 0
  let syntheticTerminals = 0

  function ensureEndpoint(
    route:
      OsmImportedFerryRoute,
    side:
      'a' | 'b',
    point:
      FerryGeoPoint,
    name: string,
    matched:
      OsmImportedFerryTerminal | undefined,
  ) {
    const portKey =
      portStableKey(
        name,
        matched,
        route,
        side,
      )

    let port =
      portsByKey.get(
        portKey,
      )

    if (!port) {
      port = {
        id:
          `osm-port-${slugify(portKey)}`,
        name,
        countryCode:
          'XX',
        countryName:
          'Da determinare',
        sources: [
          matched
            ? sourceForTerminal(
                matched,
                input.fetchedAt,
              )
            : sourceForRoute(
                route,
                input.fetchedAt,
              ),
        ],
      }

      portsByKey.set(
        portKey,
        port,
      )
    }

    const terminalKey =
      matched
        ? terminalStableKey(
            matched,
          )
        : `synthetic:${portKey}`

    let terminal =
      terminalsByKey.get(
        terminalKey,
      )

    if (!terminal) {
      if (matched) {
        matchedTerminals += 1

        terminal = {
          id:
            `osm-terminal-${matched.osmType}-${matched.osmId}`,
          portId:
            port.id,
          name:
            matched.name,
          terminalPoint:
            matched.point,
          vehicleAccessPoint:
            matched.point,
          sources: [
            sourceForTerminal(
              matched,
              input.fetchedAt,
            ),
          ],
        }
      } else {
        syntheticTerminals += 1

        terminal = {
          id:
            `osm-terminal-synthetic-${slugify(portKey)}`,
          portId:
            port.id,
          name:
            `${name} · punto rotta OSM`,
          terminalPoint:
            point,
          vehicleAccessPoint:
            point,
          sources: [
            sourceForRoute(
              route,
              input.fetchedAt,
            ),
          ],
        }
      }

      terminalsByKey.set(
        terminalKey,
        terminal,
      )
    }

    return {
      port,
      terminal,
    }
  }

  for (const route of input.routes) {
    const splitName =
      splitRouteName(
        route.name,
      )

    const matchA =
      nearestTerminal(
        route.startPoint,
        input.terminals,
      )?.terminal

    const matchB =
      nearestTerminal(
        route.endPoint,
        input.terminals,
      )?.terminal

    const nameA =
      endpointName(
        route.fromName,
        splitName?.first,
        matchA,
        `Porto OSM ${route.osmId} A`,
      )

    const nameB =
      endpointName(
        route.toName,
        splitName?.second,
        matchB,
        `Porto OSM ${route.osmId} B`,
      )

    const endpointA =
      ensureEndpoint(
        route,
        'a',
        route.startPoint,
        nameA,
        matchA,
      )

    const endpointB =
      ensureEndpoint(
        route,
        'b',
        route.endPoint,
        nameB,
        matchB,
      )

    if (
      endpointA.port.id ===
      endpointB.port.id
    ) {
      continue
    }

    const source =
      sourceForRoute(
        route,
        input.fetchedAt,
      )

    const routeId =
      `osm-route-${route.osmType}-${route.osmId}`

    routes.push({
      id: routeId,
      portAId:
        endpointA.port.id,
      portBId:
        endpointB.port.id,
      bidirectional:
        !oneWayRoute(route),
      distanceKm:
        distanceKm(
          route.startPoint,
          route.endPoint,
        ),
      sources: [source],
    })

    const service:
      FerryService = {
      id:
        `osm-service-${route.osmType}-${route.osmId}`,
      routeId,
      operator:
        cleanEndpointName(
          route.operator,
        ) ??
        'Non indicato in OSM',
      terminalAId:
        endpointA.terminal.id,
      terminalBId:
        endpointB.terminal.id,
      motorcycleAllowed:
        route.motorcycleAllowed,
      sources: [source],
    }

    if (
      route.durationMinutes !==
      undefined
    ) {
      service.durationMinutesMin =
        route.durationMinutes

      service.durationMinutesMax =
        route.durationMinutes
    }

    if (
      cleanEndpointName(
        route.tags.opening_hours,
      )
    ) {
      service.seasonNotes =
        `OSM opening_hours: ${route.tags.opening_hours}`
    }

    services.push(service)
  }

  const catalog:
    FerryCatalogData = {
    ports:
      [...portsByKey.values()],
    terminals:
      [...terminalsByKey.values()],
    routes,
    services,
  }

  return {
    catalog,
    stats: {
      sourceRoutes:
        input.routes.length,
      sourceTerminals:
        input.terminals.length,
      ports:
        catalog.ports.length,
      terminals:
        catalog.terminals.length,
      routes:
        catalog.routes.length,
      services:
        catalog.services.length,
      matchedTerminals,
      syntheticTerminals,
    },
  }
}
