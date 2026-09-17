import type {
  FerryCatalogData,
  FerryDataSource,
  FerryGeoPoint,
  FerryPort,
  FerryRoute,
  FerryService,
  FerryTerminal,
} from './ferryCatalogTypes'

export type FerryCatalogMergeStats = {
  matchedPorts: number
  addedPorts: number

  matchedTerminals: number
  addedTerminals: number

  matchedRoutes: number
  addedRoutes: number

  matchedServices: number
  addedServices: number
}

export type FerryCatalogMergeResult = {
  catalog: FerryCatalogData
  stats: FerryCatalogMergeStats
}

const PORT_PROXIMITY_KM =
  3

const TERMINAL_PROXIMITY_KM =
  0.8

function normalizeText(
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
      /\b(ferry|ferries|terminal|terminale|porto|port|harbour|harbor|fergeterminal|fergeterminalen)\b/g,
      ' ',
    )
    .replace(
      /[^a-z0-9]+/g,
      ' ',
    )
    .trim()
}

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

function sourceKey(
  source: FerryDataSource,
) {
  return [
    source.kind,
    source.provider,
    source.reference ?? '',
  ].join('|')
}

function mergeSources(
  first: FerryDataSource[],
  second: FerryDataSource[],
) {
  const byKey =
    new Map<string, FerryDataSource>()

  for (const source of [
    ...first,
    ...second,
  ]) {
    byKey.set(
      sourceKey(source),
      source,
    )
  }

  return [...byKey.values()]
}

function cloneCatalog(
  source: FerryCatalogData,
): FerryCatalogData {
  return {
    ports:
      source.ports.map(
        (port) => ({
          ...port,
          aliases:
            port.aliases
              ? [...port.aliases]
              : undefined,
          sources:
            [...port.sources],
        }),
      ),

    terminals:
      source.terminals.map(
        (terminal) => ({
          ...terminal,
          terminalPoint:
            terminal.terminalPoint
              ? {...terminal.terminalPoint}
              : undefined,
          vehicleAccessPoint:
            terminal.vehicleAccessPoint
              ? {...terminal.vehicleAccessPoint}
              : undefined,
          sources:
            [...terminal.sources],
        }),
      ),

    routes:
      source.routes.map(
        (route) => ({
          ...route,
          sources:
            [...route.sources],
        }),
      ),

    services:
      source.services.map(
        (service) => ({
          ...service,
          sources:
            [...service.sources],
        }),
      ),
  }
}

function terminalPoint(
  terminal: FerryTerminal,
) {
  return (
    terminal.vehicleAccessPoint ??
    terminal.terminalPoint ??
    null
  )
}

function portTerminals(
  catalog: FerryCatalogData,
  portId: string,
) {
  return catalog.terminals
    .filter(
      (terminal) =>
        terminal.portId ===
        portId,
    )
}

function namesForPort(
  port: FerryPort,
) {
  return [
    port.name,
    ...(port.aliases ?? []),
  ]
    .map(normalizeText)
    .filter(Boolean)
}

function findMatchingPort(
  target: FerryCatalogData,
  sourceCatalog: FerryCatalogData,
  sourcePort: FerryPort,
) {
  const sourceNames =
    new Set(
      namesForPort(
        sourcePort,
      ),
    )

  const byName =
    target.ports.find(
      (port) =>
        namesForPort(port)
          .some(
            (name) =>
              sourceNames.has(name),
          ),
    )

  if (byName) {
    return byName
  }

  const sourcePoints =
    portTerminals(
      sourceCatalog,
      sourcePort.id,
    )
      .map(terminalPoint)
      .filter(
        (
          point,
        ): point is FerryGeoPoint =>
          point !== null,
      )

  if (sourcePoints.length === 0) {
    return null
  }

  let best:
    | {
        port: FerryPort
        distanceKm: number
      }
    | null = null

  for (const targetPort of target.ports) {
    const targetPoints =
      portTerminals(
        target,
        targetPort.id,
      )
        .map(terminalPoint)
        .filter(
          (
            point,
          ): point is FerryGeoPoint =>
            point !== null,
        )

    for (const first of sourcePoints) {
      for (const second of targetPoints) {
        const current =
          distanceKm(
            first,
            second,
          )

        if (
          current <=
            PORT_PROXIMITY_KM &&
          (
            !best ||
            current <
              best.distanceKm
          )
        ) {
          best = {
            port:
              targetPort,
            distanceKm:
              current,
          }
        }
      }
    }
  }

  return best?.port ?? null
}

function findMatchingTerminal(
  target: FerryCatalogData,
  sourceTerminal: FerryTerminal,
  mappedPortId: string,
) {
  const candidates =
    target.terminals
      .filter(
        (terminal) =>
          terminal.portId ===
          mappedPortId,
      )

  const sourceName =
    normalizeText(
      sourceTerminal.name,
    )

  const byName =
    candidates.find(
      (terminal) =>
        normalizeText(
          terminal.name,
        ) === sourceName,
    )

  if (byName) {
    return byName
  }

  const sourcePoint =
    terminalPoint(
      sourceTerminal,
    )

  if (!sourcePoint) {
    return null
  }

  let best:
    | {
        terminal: FerryTerminal
        distanceKm: number
      }
    | null = null

  for (const terminal of candidates) {
    const point =
      terminalPoint(terminal)

    if (!point) {
      continue
    }

    const current =
      distanceKm(
        sourcePoint,
        point,
      )

    if (
      current <=
        TERMINAL_PROXIMITY_KM &&
      (
        !best ||
        current <
          best.distanceKm
      )
    ) {
      best = {
        terminal,
        distanceKm:
          current,
      }
    }
  }

  return best?.terminal ?? null
}

function routeKey(
  firstPortId: string,
  secondPortId: string,
) {
  return [
    firstPortId,
    secondPortId,
  ]
    .sort()
    .join('|')
}

function findMatchingRoute(
  catalog: FerryCatalogData,
  firstPortId: string,
  secondPortId: string,
) {
  const key =
    routeKey(
      firstPortId,
      secondPortId,
    )

  return (
    catalog.routes.find(
      (route) =>
        routeKey(
          route.portAId,
          route.portBId,
        ) === key,
    ) ??
    null
  )
}

function findMatchingService(
  catalog: FerryCatalogData,
  routeId: string,
  operator: string,
) {
  const normalizedOperator =
    normalizeText(operator)

  return (
    catalog.services.find(
      (service) =>
        service.routeId ===
          routeId &&
        normalizeText(
          service.operator,
        ) ===
          normalizedOperator,
    ) ??
    null
  )
}

function uniqueStrings(
  values: string[],
) {
  return [...new Set(values)]
}

export function mergeFerryCatalogs(
  primary: FerryCatalogData,
  supplement: FerryCatalogData,
): FerryCatalogMergeResult {
  const catalog =
    cloneCatalog(primary)

  const stats:
    FerryCatalogMergeStats = {
    matchedPorts: 0,
    addedPorts: 0,
    matchedTerminals: 0,
    addedTerminals: 0,
    matchedRoutes: 0,
    addedRoutes: 0,
    matchedServices: 0,
    addedServices: 0,
  }

  const portIdMap =
    new Map<string, string>()

  const terminalIdMap =
    new Map<string, string>()

  const routeIdMap =
    new Map<string, string>()

  for (const sourcePort of supplement.ports) {
    const matched =
      findMatchingPort(
        catalog,
        supplement,
        sourcePort,
      )

    if (matched) {
      matched.aliases =
        uniqueStrings([
          ...(matched.aliases ?? []),
          sourcePort.name,
          ...(sourcePort.aliases ?? []),
        ])
          .filter(
            (value) =>
              normalizeText(value) !==
              normalizeText(matched.name),
          )

      matched.sources =
        mergeSources(
          matched.sources,
          sourcePort.sources,
        )

      portIdMap.set(
        sourcePort.id,
        matched.id,
      )

      stats.matchedPorts += 1
      continue
    }

    catalog.ports.push({
      ...sourcePort,
      aliases:
        sourcePort.aliases
          ? [...sourcePort.aliases]
          : undefined,
      sources:
        [...sourcePort.sources],
    })

    portIdMap.set(
      sourcePort.id,
      sourcePort.id,
    )

    stats.addedPorts += 1
  }

  for (
    const sourceTerminal
    of supplement.terminals
  ) {
    const mappedPortId =
      portIdMap.get(
        sourceTerminal.portId,
      ) ??
      sourceTerminal.portId

    const matched =
      findMatchingTerminal(
        catalog,
        sourceTerminal,
        mappedPortId,
      )

    if (matched) {
      matched.sources =
        mergeSources(
          matched.sources,
          sourceTerminal.sources,
        )

      if (!matched.address) {
        matched.address =
          sourceTerminal.address
      }

      if (!matched.terminalPoint) {
        matched.terminalPoint =
          sourceTerminal.terminalPoint
            ? {...sourceTerminal.terminalPoint}
            : undefined
      }

      if (!matched.vehicleAccessPoint) {
        matched.vehicleAccessPoint =
          sourceTerminal.vehicleAccessPoint
            ? {...sourceTerminal.vehicleAccessPoint}
            : undefined
      }

      terminalIdMap.set(
        sourceTerminal.id,
        matched.id,
      )

      stats.matchedTerminals += 1
      continue
    }

    const added = {
      ...sourceTerminal,
      portId:
        mappedPortId,
      terminalPoint:
        sourceTerminal.terminalPoint
          ? {...sourceTerminal.terminalPoint}
          : undefined,
      vehicleAccessPoint:
        sourceTerminal.vehicleAccessPoint
          ? {...sourceTerminal.vehicleAccessPoint}
          : undefined,
      sources:
        [...sourceTerminal.sources],
    }

    catalog.terminals.push(added)

    terminalIdMap.set(
      sourceTerminal.id,
      added.id,
    )

    stats.addedTerminals += 1
  }

  for (const sourceRoute of supplement.routes) {
    const portAId =
      portIdMap.get(
        sourceRoute.portAId,
      ) ??
      sourceRoute.portAId

    const portBId =
      portIdMap.get(
        sourceRoute.portBId,
      ) ??
      sourceRoute.portBId

    const matched =
      findMatchingRoute(
        catalog,
        portAId,
        portBId,
      )

    if (matched) {
      matched.sources =
        mergeSources(
          matched.sources,
          sourceRoute.sources,
        )

      if (
        matched.distanceKm ===
        undefined
      ) {
        matched.distanceKm =
          sourceRoute.distanceKm
      }

      routeIdMap.set(
        sourceRoute.id,
        matched.id,
      )

      stats.matchedRoutes += 1
      continue
    }

    const added:
      FerryRoute = {
      ...sourceRoute,
      portAId,
      portBId,
      sources:
        [...sourceRoute.sources],
    }

    catalog.routes.push(added)

    routeIdMap.set(
      sourceRoute.id,
      added.id,
    )

    stats.addedRoutes += 1
  }

  for (
    const sourceService
    of supplement.services
  ) {
    const routeId =
      routeIdMap.get(
        sourceService.routeId,
      ) ??
      sourceService.routeId

    const matched =
      findMatchingService(
        catalog,
        routeId,
        sourceService.operator,
      )

    if (matched) {
      matched.sources =
        mergeSources(
          matched.sources,
          sourceService.sources,
        )

      if (
        matched.terminalAId ===
        undefined &&
        sourceService.terminalAId
      ) {
        matched.terminalAId =
          terminalIdMap.get(
            sourceService.terminalAId,
          ) ??
          sourceService.terminalAId
      }

      if (
        matched.terminalBId ===
        undefined &&
        sourceService.terminalBId
      ) {
        matched.terminalBId =
          terminalIdMap.get(
            sourceService.terminalBId,
          ) ??
          sourceService.terminalBId
      }

      if (
        matched.motorcycleAllowed ===
        undefined
      ) {
        matched.motorcycleAllowed =
          sourceService.motorcycleAllowed
      }

      if (
        matched.yearRound ===
        undefined
      ) {
        matched.yearRound =
          sourceService.yearRound
      }

      if (
        matched.durationMinutesMin ===
        undefined
      ) {
        matched.durationMinutesMin =
          sourceService.durationMinutesMin
      }

      if (
        matched.durationMinutesMax ===
        undefined
      ) {
        matched.durationMinutesMax =
          sourceService.durationMinutesMax
      }

      if (!matched.seasonNotes) {
        matched.seasonNotes =
          sourceService.seasonNotes
      }

      stats.matchedServices += 1
      continue
    }

    const added:
      FerryService = {
      ...sourceService,
      routeId,
      terminalAId:
        sourceService.terminalAId
          ? terminalIdMap.get(
              sourceService.terminalAId,
            ) ??
            sourceService.terminalAId
          : undefined,
      terminalBId:
        sourceService.terminalBId
          ? terminalIdMap.get(
              sourceService.terminalBId,
            ) ??
            sourceService.terminalBId
          : undefined,
      sources:
        [...sourceService.sources],
    }

    catalog.services.push(added)
    stats.addedServices += 1
  }

  return {
    catalog,
    stats,
  }
}
