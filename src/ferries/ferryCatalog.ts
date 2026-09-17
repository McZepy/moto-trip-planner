import {
  FERRY_CATALOG_SEED,
} from './ferryCatalogSeed'

import type {
  FerryCatalogData,
  FerryPort,
  FerryRoute,
  FerryService,
  FerryTerminal,
} from './ferryCatalogTypes'

let ACTIVE_FERRY_CATALOG:
  FerryCatalogData =
    FERRY_CATALOG_SEED

export function getFerryCatalog() {
  return ACTIVE_FERRY_CATALOG
}

export function setFerryCatalog(
  catalog:
    FerryCatalogData,
) {
  ACTIVE_FERRY_CATALOG =
    catalog
}

export function resetFerryCatalog() {
  ACTIVE_FERRY_CATALOG =
    FERRY_CATALOG_SEED
}

export function getFerryPortById(
  id: string,
) {
  return (
    ACTIVE_FERRY_CATALOG
      .ports
      .find(
        (port) =>
          port.id === id,
      ) ??
    null
  )
}

export function getFerryTerminalById(
  id: string,
) {
  return (
    ACTIVE_FERRY_CATALOG
      .terminals
      .find(
        (terminal) =>
          terminal.id === id,
      ) ??
    null
  )
}

export function getFerryRouteById(
  id: string,
) {
  return (
    ACTIVE_FERRY_CATALOG
      .routes
      .find(
        (route) =>
          route.id === id,
      ) ??
    null
  )
}

export function getFerryServicesForRoute(
  routeId: string,
) {
  return (
    ACTIVE_FERRY_CATALOG
      .services
      .filter(
        (service) =>
          service.routeId ===
          routeId,
      )
  )
}

export function findFerryRoutesBetweenPorts(
  firstPortId: string,
  secondPortId: string,
) {
  return (
    ACTIVE_FERRY_CATALOG
      .routes
      .filter(
        (route) =>
          (
            route.portAId ===
              firstPortId &&
            route.portBId ===
              secondPortId
          ) ||
          (
            route.bidirectional &&
            route.portAId ===
              secondPortId &&
            route.portBId ===
              firstPortId
          ),
      )
  )
}

export function findFerryRoutesForPort(
  portId: string,
) {
  return (
    ACTIVE_FERRY_CATALOG
      .routes
      .filter(
        (route) =>
          route.portAId ===
            portId ||
          route.portBId ===
            portId,
      )
  )
}

function normalizeSearchText(
  value: string,
) {
  return value
    .normalize('NFD')
    .replace(
      /\p{Diacritic}/gu,
      '',
    )
    .toLocaleLowerCase()
    .trim()
}

export function searchFerryPorts(
  query: string,
) {
  const normalized =
    normalizeSearchText(
      query,
    )

  if (!normalized) {
    return []
  }

  return (
    ACTIVE_FERRY_CATALOG
      .ports
      .filter(
        (port) => {
          const values = [
            port.name,
            ...(
              port.aliases ??
              []
            ),
          ]

          return values.some(
            (value) =>
              normalizeSearchText(
                value,
              ).includes(
                normalized,
              ),
          )
        },
      )
  )
}

export type FerryServiceView = {
  service:
    FerryService

  route:
    FerryRoute

  portA:
    FerryPort
  portB:
    FerryPort

  terminalA:
    FerryTerminal | null

  terminalB:
    FerryTerminal | null
}

export function listFerryServiceViews():
  FerryServiceView[] {
  const result:
    FerryServiceView[] = []

  for (
    const service
    of ACTIVE_FERRY_CATALOG
      .services
  ) {
    const route =
      getFerryRouteById(
        service.routeId,
      )

    if (!route) {
      continue
    }

    const portA =
      getFerryPortById(
        route.portAId,
      )

    const portB =
      getFerryPortById(
        route.portBId,
      )

    if (
      !portA ||
      !portB
    ) {
      continue
    }

    const terminalA =
      service.terminalAId
        ? getFerryTerminalById(
            service
              .terminalAId,
          )
        : null

    const terminalB =
      service.terminalBId
        ? getFerryTerminalById(
            service
              .terminalBId,
          )
        : null

    result.push({
      service,
      route,
      portA,
      portB,
      terminalA,
      terminalB,
    })
  }

  return result
}

export function listRoutableFerryServices() {
  return listFerryServiceViews()
    .filter(
      (view) =>
        view.service
          .motorcycleAllowed !==
          false &&
        Boolean(
          view.terminalA
            ?.vehicleAccessPoint ??
            view.terminalA
              ?.terminalPoint,
        ) &&
        Boolean(
          view.terminalB
            ?.vehicleAccessPoint ??
            view.terminalB
              ?.terminalPoint,
        ),
    )
}
